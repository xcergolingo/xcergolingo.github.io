// Photo-derived RC sport jets. Units are relative model units, nose +Z / up +Y.
// All surfaces, liveries and cockpit details are generated locally with Three.js.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function canvasTexture(THREE, width, height, draw, name) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const map = new THREE.CanvasTexture(canvas); map.name = name;
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return map;
}

function profileAt(stations, z) {
  const st = [...stations].sort((a, b) => a[0] - b[0]);
  let i = 0; while (i < st.length - 2 && st[i + 1][0] < z) i++;
  const t = clamp((z - st[i][0]) / (st[i + 1][0] - st[i][0]), 0, 1), t2 = t * t, t3 = t2 * t;
  const row = [z];
  for (let k = 1; k < 5; k++) {
    const a = st[Math.max(0, i - 1)][k] || 0, b = st[i][k] || 0;
    const c = st[i + 1][k] || 0, d = st[Math.min(st.length - 1, i + 2)][k] || 0;
    row[k] = .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    if (k < 3) row[k] = Math.max(.001, row[k]);
  }
  return row;
}

// Draw a band on both sides of the cylindrical UV map. q is normalized height.
function sideBand(c, w, h, minZ, maxZ, startZ, endZ, lower, upper, fill, clip = false) {
  c.beginPath();
  for (const sign of [1, -1]) {
    const coord = (z, q) => {
      let angle = Math.acos(clamp(q, -.999, .999)); if (sign < 0) angle = TAU - angle;
      return [angle / TAU * w, (maxZ - z) / (maxZ - minZ) * h];
    };
    for (let j = 0; j <= 70; j++) {
      const z = startZ + (endZ - startZ) * j / 70, p = coord(z, upper(z));
      if (j === 0) c.moveTo(...p); else c.lineTo(...p);
    }
    for (let j = 70; j >= 0; j--) {
      const z = startZ + (endZ - startZ) * j / 70; c.lineTo(...coord(z, lower(z)));
    }
    c.closePath();
  }
  if (clip) c.clip(); else { c.fillStyle = fill; c.fill(); }
}

function topBand(c, w, h, minZ, maxZ, startZ, endZ, edge, fill) {
  c.fillStyle = fill;
  for (const sign of [0, 1]) {
    c.beginPath();
    const baseX = sign ? w : 0;
    c.moveTo(baseX, (maxZ - startZ) / (maxZ - minZ) * h);
    for (let j = 0; j <= 100; j++) {
      const z = startZ + (endZ - startZ) * j / 100;
      const a = Math.acos(clamp(edge(z), -.99, .99)) / TAU * w;
      c.lineTo(sign ? w - a : a, (maxZ - z) / (maxZ - minZ) * h);
    }
    c.lineTo(baseX, (maxZ - endZ) / (maxZ - minZ) * h); c.closePath(); c.fill();
  }
}

function paintedBody(THREE, H, parent, name, stations, draw, options = {}) {
  const minZ = Math.min(...stations.map(s => s[0])), maxZ = Math.max(...stations.map(s => s[0]));
  const map = canvasTexture(THREE, 1024, 2048, (c, w, h) => draw(c, w, h, minZ, maxZ), name + ' livery');
  const material = H.mat(0xffffff, { map, roughness: .27, metalness: .35, clearcoat: .9, clearcoatRoughness: .16, ...options });
  const m = H.loft(parent, name, stations, material, { segments: 64, subdiv: 8 });
  const ps = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < ps.count; i++) uv.setY(i, (ps.getZ(i) - minZ) / (maxZ - minZ));
  uv.needsUpdate = true;
  return { mesh: m, stations, minZ, maxZ };
}

// A small curved mesh holds lettering against the fuselage instead of floating off it.
function bodyDecal(THREE, H, parent, body, side, name, centerZ, length, qBottom, qTop, draw) {
  const nu = 36, nv = 10, positions = [], uv = [], indices = [];
  for (let j = 0; j <= nv; j++) {
    const q = qBottom + (qTop - qBottom) * j / nv;
    for (let i = 0; i <= nu; i++) {
      const z = centerZ + (side > 0 ? 1 : -1) * length * (.5 - i / nu);
      const [, rx, ry, cy, cx] = profileAt(body.stations, z);
      positions.push(cx + side * Math.sqrt(1 - q * q) * (rx + .012), cy + q * (ry + .012), z);
      uv.push(i / nu, j / nv);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + nu + 1;
    if (side > 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
    else indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(indices); geo.computeVertexNormals();
  const map = canvasTexture(THREE, 1024, 256, draw, name + ' decal');
  const material = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: .35, metalness: .12, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = H.mesh(parent, name, geo, material); m.castShadow = false; m.renderOrder = 2; return m;
}

function wingSurfaceTexture(THREE, stations, style, tail = false) {
  const minX = Math.min(...stations.map(s => Math.abs(s[0]))), maxX = Math.max(...stations.map(s => Math.abs(s[0])));
  const minZ = Math.min(...stations.map(s => s[2])), maxZ = Math.max(...stations.map(s => s[1]));
  const map = canvasTexture(THREE, 1024, 1024, (c, w, h) => {
    const point = (x, z) => [(x - minX) / (maxX - minX) * w, (maxZ - z) / (maxZ - minZ) * h];
    const polygon = (pts, fill) => { c.beginPath(); pts.forEach(([u, v], i) => i ? c.lineTo(u * w, v * h) : c.moveTo(u * w, v * h)); c.closePath(); c.fillStyle = fill; c.fill(); };
    if (style === 'rare') {
      c.fillStyle = '#eff3f3'; c.fillRect(0, 0, w, h);
      const yellow = c.createLinearGradient(0, 0, w, h); yellow.addColorStop(0, '#ffdb17'); yellow.addColorStop(1, '#dfe62d');
      polygon([[0, 0], [.61, 0], [.65, .28], [.60, .72], [.55, 1], [0, 1]], yellow);
      const orange = c.createLinearGradient(0, 0, w * .4, h); orange.addColorStop(0, '#ff681d'); orange.addColorStop(1, '#ee391a');
      polygon([[0, 0], [.26, 0], [.29, .28], [.26, .70], [.19, 1], [0, 1]], orange);
    } else {
      c.fillStyle = '#10201e'; c.fillRect(0, 0, w, h);
      // Swept lightning graphics, following the wing's changing chord.
      const yellow = '#e6ff08';
      polygon([[0, .12], [.97, .70], [.80, .74], [.23, .39], [.56, .77], [.39, .85], [0, .49]], yellow);
      polygon([[.02, .71], [.31, .77], [.56, .96], [.40, 1], [0, .83]], yellow);
      polygon([[.59, .12], [1, .48], [1, .56], [.74, .46], [.89, .64], [.73, .60]], yellow);
      polygon([[.02, .03], [.39, .16], [.71, .45], [.44, .28], [.15, .20]], '#6b7b77');
      if (tail) polygon([[0, .08], [.93, .58], [.97, .75], [.59, .54], [.70, .82], [.16, .53]], yellow);
    }
    const st = [...stations].sort((a, b) => Math.abs(a[0]) - Math.abs(b[0]));
    const sample = (x) => {
      let i = 0; while (i < st.length - 2 && Math.abs(st[i + 1][0]) < x) i++;
      const t = clamp((x - Math.abs(st[i][0])) / (Math.abs(st[i + 1][0]) - Math.abs(st[i][0])), 0, 1);
      return [st[i][1] + (st[i + 1][1] - st[i][1]) * t, st[i][2] + (st[i + 1][2] - st[i][2]) * t];
    };
    const left = minX + (maxX - minX) * .33, right = minX + (maxX - minX) * .94;
    c.strokeStyle = style === 'rare' ? 'rgba(36,46,52,.48)' : 'rgba(184,203,195,.37)'; c.lineWidth = 1.6;
    c.beginPath();
    for (let j = 0; j <= 32; j++) {
      const x = left + (right - left) * j / 32, [leading, trailing] = sample(x), p = point(x, trailing + (leading - trailing) * .23);
      if (j === 0) c.moveTo(...point(x, trailing)); c.lineTo(...p);
      if (j === 32) c.lineTo(...point(x, trailing));
    }
    c.stroke();
    for (const x of [minX + .17 * (maxX - minX), minX + .91 * (maxX - minX)]) {
      const [lead, trail] = sample(x); c.beginPath(); c.moveTo(...point(x, lead - .04)); c.lineTo(...point(x, trail + .04)); c.stroke();
    }
    // Small flush hinge panels and fastening marks are painted into the surface.
    for (const a of [.43, .67, .86]) {
      const x = minX + (maxX - minX) * a, [lead, trail] = sample(x), p = point(x, trail + (lead - trail) * .12);
      c.fillStyle = style === 'rare' ? 'rgba(227,234,232,.8)' : 'rgba(20,31,29,.9)'; c.fillRect(p[0] - 8, p[1] - 16, 16, 32);
      c.strokeStyle = 'rgba(54,66,65,.5)'; c.strokeRect(p[0] - 8, p[1] - 16, 16, 32);
      c.fillStyle = '#6e797a'; for (const y of [-11, 11]) { c.beginPath(); c.arc(p[0], p[1] + y, 1.8, 0, TAU); c.fill(); }
    }
  }, style + (tail ? ' tailplane' : ' main wing') + ' paint and panels');
  return { map, minX, maxX, minZ, maxZ };
}

function paintedWing(THREE, H, parent, name, stations, style, tail = false) {
  const t = wingSurfaceTexture(THREE, stations, style, tail);
  const m = H.wing(parent, name, stations, H.mat(0xffffff, { map: t.map, roughness: .28, metalness: .24, clearcoat: .9, clearcoatRoughness: .15 }));
  const ps = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < ps.count; i++) uv.setXY(i, (Math.abs(ps.getX(i)) - t.minX) / (t.maxX - t.minX), (ps.getZ(i) - t.minZ) / (t.maxZ - t.minZ));
  uv.needsUpdate = true; return m;
}

function bodySeam(H, parent, body, z, color = 0x27123b, opacity = .34) {
  const [, rx, ry, cy, cx] = profileAt(body.stations, z), pts = [];
  for (let i = 0; i <= 80; i++) { const a = i / 80 * TAU; pts.push([cx + Math.sin(a) * (rx + .005), cy + Math.cos(a) * (ry + .005), z]); }
  H.line(parent, 'Fuselage panel joint', pts, color, opacity);
}

function navigationLights(H, group, x, y, z) {
  for (const side of [-1, 1]) {
    const mat = H.mat(side < 0 ? 0xdb2a20 : 0x32be75, { emissive: side < 0 ? 0x81190d : 0x006c2d, emissiveIntensity: .7, roughness: .2, metalness: .1 });
    H.ellipsoid(group, side < 0 ? 'Port red navigation lamp' : 'Starboard green navigation lamp', [side * x, y, z], [.035, .025, .075], mat);
  }
}

export function createRareBear(THREE, H) {
  const group = new THREE.Group(); group.name = 'Rare Bear 77 — purple RC sport jet';
  const structure = H.group(group, 'Purple airframe and racing livery');
  const purple = H.mat(0x50128c, { metalness: .48, roughness: .24, clearcoat: 1, clearcoatRoughness: .13 });
  const purpleDark = H.mat(0x321355, { metalness: .36, roughness: .32 });
  const white = H.mat(0xe6ebdf, { metalness: .22, roughness: .28 });
  const stations = [[-5.48,.41,.40,-.06],[-4.95,.49,.46,-.02],[-4,.62,.51,.025],[-2.7,.80,.56,.02],[-1.3,.94,.61,.015],[0,.94,.64,.025],[1.25,.82,.61,.025],[2.35,.68,.51,.02],[3.5,.55,.42,.025],[4.55,.40,.30,.025],[5.5,.19,.13,.025],[6.05,.007,.012,.025]];
  const body = paintedBody(THREE, H, structure, 'Continuous purple fuselage', stations, (c,w,h,min,max) => {
    c.fillStyle = '#58158d'; c.fillRect(0,0,w,h);
    const orange = c.createLinearGradient(0, 0, 0, h * .42); orange.addColorStop(0, '#ff5d15'); orange.addColorStop(.5, '#ff8b18'); orange.addColorStop(1, '#eb7e24');
    sideBand(c,w,h,min,max,2.1,6.02,z=>-.43+Math.max(0,3.8-z)*.11,z=>.42-.08*Math.max(0,3.7-z),orange);
    c.save();
    sideBand(c,w,h,min,max,2.15,5.65,z=>.12+.045*(z-3),z=>.51+.025*(z-3),'#ffe651',true);
    c.fillStyle='#f9e34a';c.fillRect(0,0,w,h);
    const cw=34,ch=64;
    for(let y=0;y<h;y+=ch)for(let x=0;x<w;x+=cw)if((Math.floor(x/cw)+Math.floor(y/ch))%2===0){c.fillStyle='#f3b122';c.fillRect(x,y,cw,ch);}
    c.restore();
    sideBand(c,w,h,min,max,-5.18,3.15,z=>.43+.07*Math.sin((z+1)*.45),z=>.53+.07*Math.sin((z+1)*.45),'#eaf1df');
    sideBand(c,w,h,min,max,-5.38,-1.75,z=>-.40,z=>.39-.30*clamp((z+5.38)/3.63,0,1),'#ef581e');
    sideBand(c,w,h,min,max,-5.38,-3.75,z=>-.43,z=>-.24,'#f5e246');
    c.strokeStyle='rgba(22,8,42,.19)'; c.lineWidth=2;
    for(const z of [-4.3,-2.25,.05,1.75,4.75]){const y=(max-z)/(max-min)*h;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  }, { metalness: .42 });

  // Fuller, rounded shoulders and white intake rings distinguish this RC trainer.
  for(const side of [-1,1]) {
    H.loft(structure,'Sculpted side intake shoulder',[[.05,.27,.35,-.02,side*.68],[.85,.37,.38,-.015,side*.73],[1.72,.31,.32,-.005,side*.73],[2.15,.245,.27,.015,side*.66]],purple,{segments:40,subdiv:6});
    H.intake(structure,'Oval side air inlet',{x:side*.71,y:-.02,z:2.13,width:.52,height:.55,depth:1.3,color:0x55198a});
    H.loft(structure,'White intake collar',[[1.93,.279,.289,-.02,side*.71],[2.015,.278,.289,-.02,side*.71]],white,{segments:40,subdiv:1});
  }

  for(const side of [-1,1]) {
    paintedWing(THREE,H,structure,side<0?'Port orange-yellow-white wing':'Starboard orange-yellow-white wing',[[side*.67,1.18,-2.14,-.16,.20],[side*1.28,.91,-2.35,-.14,.175],[side*3.94,-.78,-3.05,-.04,.105],[side*4.32,-1.04,-3.08,-.02,.065]],'rare');
    paintedWing(THREE,H,structure,side<0?'Port racing tailplane':'Starboard racing tailplane',[[side*.37,-3.57,-5.42,.12,.12],[side*1.00,-3.82,-5.52,.17,.095],[side*2.34,-4.20,-5.63,.22,.065]],'rare',true);
  }
  H.fin(structure,'Swept purple vertical fin',[[.34,-2.64],[.89,-3.24],[3.05,-4.70],[3.12,-5.73],[.31,-5.48]],.145,0,purple);
  H.fin(structure,'Smooth dorsal fin fillet',[[.46,-1.56],[.55,-2.02],[1.15,-3.58],[.47,-4.23]],.11,0,purple);
  H.line(structure,'Rudder hinge right',[[.103,.60,-5.10],[.103,2.87,-5.48]],0x27113d,.55);
  H.line(structure,'Rudder hinge left',[[-.103,.60,-5.10],[-.103,2.87,-5.48]],0x27113d,.55);
  for(const side of [-1,1]) {
    H.decal(structure,'Racing number 77',{width:1.78,height:1.30,pos:[side*.103,1.52,-4.69],rot:[0,side*Math.PI/2,0],canvasWidth:1024,canvasHeight:640,draw(c,w,h){
      c.font='italic 900 560px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
      c.strokeStyle='#191321';c.lineWidth=28;c.strokeText('77',w*.49,h*.54,w*.96);
      c.strokeStyle='#efe6a8';c.lineWidth=10;c.strokeText('77',w*.49,h*.54,w*.96);
      const gr=c.createLinearGradient(0,h*.15,0,h*.84);gr.addColorStop(0,'#fff6bf');gr.addColorStop(.36,'#eec768');gr.addColorStop(1,'#ea521b');
      c.fillStyle=gr;c.fillText('77',w*.49,h*.54,w*.96);
    }});
    bodyDecal(THREE,H,structure,body,side,'Rare Bear racing script',-2.68,2.82,-.16,.38,(c,w,h)=>{
      c.font='italic 900 150px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
      c.strokeStyle='#b9a9cd';c.lineWidth=17;c.strokeText('RAREBEAR',w/2,h*.53,w*.97);
      c.strokeStyle='#160e24';c.lineWidth=10;c.strokeText('RAREBEAR',w/2,h*.53,w*.97);
      const g=c.createLinearGradient(0,45,0,200);g.addColorStop(0,'#b8a5ce');g.addColorStop(.5,'#5d2c87');g.addColorStop(1,'#a27bc6');c.fillStyle=g;c.fillText('RAREBEAR',w/2,h*.53,w*.97);
    });
  }

  const cockpit=H.cockpit(group,{z:3.16,y:.44,length:3.05,width:1.04,height:.62,seats:2,frame:0x30223b,glass:0xb6c9d0,pilot:false});
  for(const z of [3.79,2.51]) {
    H.box(cockpit.group,'Cream instrument insert',[.34,.21,.03],[0,.66,z],white,[-.15,0,0]);
    H.decal(cockpit.group,'Round analogue instruments',{width:.31,height:.18,pos:[0,.66,z-.019],rot:[0,Math.PI,0],canvasWidth:512,canvasHeight:256,draw(c,w,h){
      c.fillStyle='#dddac7';c.fillRect(0,0,w,h);for(let i=0;i<6;i++){const x=w*(.20+(i%3)*.30),y=h*(i<3?.28:.72);c.fillStyle='#182b2a';c.beginPath();c.arc(x,y,h*.17,0,TAU);c.fill();c.strokeStyle='#aab8a0';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x+15,y-18);c.stroke();}
    }});
  }
  const gear=H.gear(group,{
    noseZ:4.49,mainZ:-.87,track:1.29,groundY:-1.58,wheelRadius:.205,mainRadius:.28,
    noseHinge:[0,-.04,4.49],noseStow:[0,-.04,3.15],
    mainHinge:[.58,-.18,-.87],mainStow:[.36,0,.25],mainFlat:true,
    noseBay:{min:[-.18,-10,2.85],max:[.18,.10,4.70]},
    mainBay:{min:[.035,-10,-1.07],max:[.85,.06,.63]},
    bayCeilingY:.16,noseBayCeilingY:.22,
    skinNames:[
      'Continuous purple fuselage','Sculpted side intake shoulder',
      'Port orange-yellow-white wing','Starboard orange-yellow-white wing'
    ]
  });
  const engine=H.exhaust(group,{x:0,y:-.06,z:-5.45,r:.392,length:.48});
  for(const side of [-1,1])H.fin(structure,'Ventral stability strake',[[-.36,-3.45],[-.79,-4.6],[-.72,-5.27],[-.37,-5.02]],.045,side*.35,purpleDark);
  for(const z of [4.67,1.63,-3.61,-5.01])bodySeam(H,structure,body,z);
  navigationLights(H,structure,4.28,.025,-1.23);
  H.rod(structure,'Short dorsal aerial',[0,.62,-1.65],[0,.83,-1.8],.015,purpleDark);
  let phase=0;
  return{group,info:{name:'Rare Bear 77',livery:'Metallic purple · sunset racing bands'},update(dt,state){phase+=dt;gear.setDown(state.gear??1);cockpit.setOpen(state.canopy??0);engine.glow.material.emissiveIntensity=.06+(state.engine??0)*(1.5+.08*Math.sin(phase*14));}};
}

export function createFalcon(THREE,H) {
  const group=new THREE.Group();group.name='Falcon — neon yellow and graphite RC sport jet';
  const structure=H.group(group,'Graphite airframe with yellow lightning livery');
  const black=H.mat(0x10201f,{roughness:.23,metalness:.42,clearcoat:1,clearcoatRoughness:.14});
  const yellow=H.mat(0xe6ff05,{roughness:.27,metalness:.15,clearcoat:.95,emissive:0x9cab00,emissiveIntensity:.035});
  const stations=[[-5.48,.34,.34,-.075],[-4.90,.45,.39,-.045],[-3.8,.56,.43,-.025],[-2.15,.68,.46,-.01],[-.6,.78,.50,.015],[.9,.77,.50,.01],[2.2,.66,.44,.025],[3.5,.52,.35,.04],[4.6,.35,.23,.015],[5.5,.17,.11,-.005],[6.12,.008,.012,-.025]];
  const body=paintedBody(THREE,H,structure,'Long graphite Falcon fuselage',stations,(c,w,h,min,max)=>{
    c.fillStyle='#112220';c.fillRect(0,0,w,h);
    topBand(c,w,h,min,max,-5.27,5.76,z=>.44+.15*Math.exp(-Math.pow((z-2.2)/1.55,2))-.14*Math.exp(-Math.pow((z-4.7)/.65,2)),'#e9ff03');
    sideBand(c,w,h,min,max,-4.87,3.8,z=>-.20-.06*Math.sin(z),z=>-.01+.11*Math.sin(z*.42),'#536969');
    sideBand(c,w,h,min,max,-5.35,-2.95,z=>-.49,z=>-.29+.10*Math.sin(z*1.4),'#e5ff08');
    sideBand(c,w,h,min,max,2.85,5.05,z=>-.25+.08*(z-3),z=>-.12+.08*(z-3),'#e5ff08');
    c.strokeStyle='rgba(3,9,9,.55)';c.lineWidth=2;
    for(const z of [4.6,2.1,.35,-2.70,-4.54]){const y=(max-z)/(max-min)*h;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  },{metalness:.40,roughness:.24});
  for(const side of [-1,1]) {
    // Thin, nearly flush sport-jet intake shoulders keep the profile low.
    H.loft(structure,'Low blended intake shoulder',[[-.65,.23,.20,-.17,side*.63],[.75,.29,.25,-.15,side*.67],[2.17,.23,.22,-.15,side*.60]],black,{segments:40,subdiv:5});
    H.intake(structure,'Low oval side intake',{x:side*.61,y:-.15,z:2.16,width:.48,height:.40,depth:1.42,color:0x142722});
    paintedWing(THREE,H,structure,side<0?'Port lightning wing':'Starboard lightning wing',[[side*.61,1.10,-2.32,-.20,.17],[side*1.35,.60,-2.61,-.15,.145],[side*3.42,-1.43,-3.27,-.02,.085],[side*3.94,-2.05,-3.36,.025,.052]],'falcon');
    paintedWing(THREE,H,structure,side<0?'Port lightning stabilator':'Starboard lightning stabilator',[[side*.37,-3.56,-5.32,.035,.11],[side*.95,-3.82,-5.45,.07,.085],[side*2.17,-4.43,-5.57,.13,.055]],'falcon',true);
  }
  const fin=H.fin(structure,'Swept Falcon lightning fin',[[.28,-2.83],[.73,-3.42],[2.60,-4.56],[2.69,-5.53],[.31,-5.44]],.13,0,black);
  const finmap=canvasTexture(THREE,1024,1024,(c,w,h)=>{
    c.fillStyle='#122420';c.fillRect(0,0,w,h);
    const p=(z,y)=>[(z+5.7)/3.0*w,(2.8-y)/2.8*h];
    const poly=(pts)=>{c.beginPath();pts.forEach(([y,z],i)=>i?c.lineTo(...p(z,y)):c.moveTo(...p(z,y)));c.closePath();c.fillStyle='#e6ff04';c.fill();};
    poly([[.38,-2.86],[.81,-3.49],[2.56,-4.55],[2.78,-4.80],[2.78,-5.63],[2.11,-5.59],[1.91,-4.96],[1.40,-4.32],[.79,-3.75]]);
    poly([[.87,-3.91],[1.17,-4.66],[1.40,-5.55],[1.72,-5.55],[1.48,-4.61],[1.09,-3.99]]);
    poly([[.44,-4.15],[.49,-5.50],[.79,-5.50],[.64,-4.60]]);
    c.strokeStyle='rgba(1,11,9,.55)';c.lineWidth=3;c.beginPath();c.moveTo(...p(-5.26,.52));c.lineTo(...p(-5.34,2.48));c.stroke();
  },'Falcon vertical fin lightning');
  fin.material=H.mat(0xffffff,{map:finmap,metalness:.25,roughness:.26,clearcoat:.95});
  const fp=fin.geometry.attributes.position,fuv=fin.geometry.attributes.uv;
  for(let i=0;i<fp.count;i++)fuv.setXY(i,(fp.getZ(i)+5.7)/3.0,fp.getY(i)/2.8);
  fuv.needsUpdate=true;
  H.fin(structure,'Neon swept dorsal fillet',[[.40,-1.87],[.46,-2.56],[.88,-3.54],[.48,-4.18]],.115,0,yellow);
  for(const side of [-1,1]) {
    bodyDecal(THREE,H,structure,body,side,'Falcon side insignia',-2.21,2.36,-.02,.36,(c,w,h)=>{
      c.font='italic 900 155px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
      c.strokeStyle='#060d0b';c.lineWidth=24;c.strokeText('FALCON',w*.5,h*.52,w*.95);
      c.strokeStyle='#e9eee2';c.lineWidth=9;c.strokeText('FALCON',w*.5,h*.52,w*.95);
      c.fillStyle='#465653';c.fillText('FALCON',w*.5,h*.52,w*.95);
      c.strokeStyle='#c9d4c4';c.lineWidth=2;c.strokeText('FALCON',w*.5,h*.52,w*.95);
    });
    H.fin(structure,'Rear underside strake',[[-.34,-3.34],[-.69,-4.50],[-.61,-5.16],[-.32,-5.01]],.035,side*.29,black);
  }
  const cockpit=H.cockpit(group,{z:3.18,y:.38,length:3.11,width:1.01,height:.43,seats:1,frame:0x0b1716,glass:0x07110f,pilot:true});
  cockpit.canopy.traverse(o=>{if(o.isMesh&&o.name==='Transparent canopy glazing'){o.material.opacity=.91;o.material.transmission=.015;o.material.roughness=.16;o.material.metalness=.25;}});
  const gear=H.gear(group,{
    noseZ:4.72,mainZ:-.72,track:1.25,groundY:-1.45,wheelRadius:.18,mainRadius:.255,
    noseHinge:[0,-.01,4.72],noseStow:[0,-.01,3.46],
    mainHinge:[.52,-.14,-.72],mainStow:[.32,0,.15],mainFlat:true,linkLengthScale:.51,
    noseBay:{min:[-.17,-10,3.18],max:[.17,.10,4.92]},
    mainBay:{min:[.035,-10,-.92],max:[.74,.06,.51]},
    bayCeilingY:.16,noseBayCeilingY:.22,
    skinNames:[
      'Long graphite Falcon fuselage','Low blended intake shoulder',
      'Port lightning wing','Starboard lightning wing'
    ]
  });
  const engine=H.exhaust(group,{x:0,y:-.075,z:-5.43,r:.329,length:.47});
  for(const z of [4.45,1.81,-2.90,-4.84])bodySeam(H,structure,body,z,0x051a16,.45);
  navigationLights(H,structure,3.91,.061,-2.19);
  H.rod(structure,'Small dorsal aerial',[0,.50,-1.04],[0,.69,-1.16],.013,black);
  let phase=0;
  return{group,info:{name:'Falcon',livery:'Graphite · fluorescent yellow lightning'},update(dt,state){phase+=dt;gear.setDown(state.gear??1);cockpit.setOpen(state.canopy??0);engine.glow.material.emissiveIntensity=.045+(state.engine??0)*(1.55+.07*Math.sin(phase*15));}};
}
