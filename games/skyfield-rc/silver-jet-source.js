/**
 * Photo-inspired silver RC stealth jet.
 * Procedural, reusable Three.js geometry; no fetched models or texture files.
 * Coordinates: Y up, nose -Z. Approximately 12 × 9 × 3 model units.
 *
 *   import { createAircraft } from './model.js';
 *   const aircraft = createAircraft(THREE);
 *   scene.add(aircraft);
 *
 * The silhouette is an artistic reconstruction from one photograph. Dimensions
 * and the concealed underside are inferred, rather than manufacturer CAD.
 */

export function createAircraft(THREE, options = {}) {
  const aircraft = new THREE.Group();
  aircraft.name = 'Silver stealth jet';
  aircraft.userData = {
    description: 'Refined silver stealth jet with a detailed female pilot and opening cockpit canopy',
    coordinateSystem: 'Y up; nose points along negative Z',
    approximateLength: 11.8,
    approximateWingspan: 8.76,
    controlNames: { leftTailplane: 'tailplane-left', rightTailplane: 'tailplane-right' },
    source: 'Reconstructed artistically from the supplied photograph; not engineering CAD'
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const vec = p => new THREE.Vector3(...p);
  const materials = {};

  function mesh(name, geometry, material, parent = aircraft) {
    const obj = new THREE.Mesh(geometry, material);
    obj.name = name;
    obj.castShadow = true;
    obj.receiveShadow = true;
    parent.add(obj);
    return obj;
  }

  function canvasTexture(width, height, paint) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    paint(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  // All upper-surface UVs share the same plan projection. That makes the fine
  // panels meet across the wing/body join rather than repeating arbitrarily.
  const mapBounds = { x: 4.65, z0: -6.45, z1: 5.6 };
  const wingOutline = [
    [0.85, -2.44], [1.4, -1.98], [2.3, -1.04], [3.3, 0.04],
    [4.25, 1.00], [4.38, 1.22], [4.38, 1.62], [4.25, 1.78],
    [3.3, 2.11], [2.3, 2.48], [1.4, 2.75], [0.85, 2.60]
  ];
  const tailOutline = [
    [1.02, 2.92], [2.69, 3.65], [2.96, 4.18], [2.91, 4.77],
    [1.22, 5.36], [0.91, 4.40]
  ];

  const topTexture = canvasTexture(2048, 2048, (c, W, H) => {
    const sx = W / (2 * mapBounds.x), sz = H / (mapBounds.z1 - mapBounds.z0);
    const px = x => (x + mapBounds.x) * sx;
    const pz = z => (z - mapBounds.z0) * sz;
    c.fillStyle = '#aeb7bd'; c.fillRect(0, 0, W, H);

    // A very restrained silver variation, kept fine enough for close inspection.
    let seed = 711;
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let n = 0; n < 14000; n++) {
      c.fillStyle = rand() > .5 ? 'rgba(255,255,255,.013)' : 'rgba(32,48,56,.014)';
      c.fillRect(rand() * W, rand() * H, 1 + rand() * 3, 1 + rand() * 3);
    }

    const path = (pts, close = true) => {
      c.beginPath(); pts.forEach(([x,z],i) => i ? c.lineTo(px(x), pz(z)) : c.moveTo(px(x), pz(z)));
      if (close) c.closePath();
    };
    const poly = (pts, fill, stroke, width = .012) => {
      path(pts); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = width * sx; c.strokeStyle = stroke; c.stroke(); }
    };
    const line = (pts, color = 'rgba(59,76,84,.48)', width = .009) => {
      path(pts, false); c.lineWidth = width * sx; c.lineJoin = 'round'; c.strokeStyle = color; c.stroke();
    };
    const mirror = (pts, s) => pts.map(([x,z]) => [x * s,z]);
    const seam = pts => { line(pts,'rgba(202,212,216,.56)',.024); line(pts,'rgba(74,88,94,.44)',.005); };
    const screw = (x,z,r=.009) => {
      c.beginPath(); c.arc(px(x),pz(z),r*sx,0,Math.PI*2); c.fillStyle='rgba(52,69,77,.5)'; c.fill();
      c.fillStyle='rgba(239,242,242,.7)'; c.fillRect(px(x)-1,pz(z)-1,1,1);
    };
    const stencil = (text, x,z,size=.055,rotate=0) => {
      c.save(); c.translate(px(x),pz(z)); c.rotate(rotate); c.font=`600 ${size*sx}px sans-serif`;
      c.fillStyle='rgba(60,75,81,.65)'; c.textAlign='center'; c.fillText(text,0,0); c.restore();
    };

    for (const s of [-1,1]) {
      poly(mirror(wingOutline,s),'#a7b3ba','#c5cfd4',.075);
      poly(mirror([[1.34,-1.9],[2.6,-.76],[3.97,1.1],[3.17,1.26],[2.53,.39],[1.47,.11]],s),'rgba(111,133,144,.12)');
      poly(mirror([[1.49,.18],[2.44,.51],[3.27,1.4],[3.89,1.32],[4.14,1.62],[2.4,2.27],[1.47,2.5]],s),'rgba(204,213,215,.21)');
      line(mirror([[1.40,-1.84],[2.31,-.89],[3.30,.18],[4.17,1.08]],s),'rgba(83,106,116,.55)',.012);
      line(mirror([[1.54,-1.73],[2.45,-.78],[3.39,.23],[4.2,1.14]],s),'rgba(208,218,223,.51)',.011);
      seam(mirror([[1.68,2.5],[1.79,2.17],[2.15,2.04],[2.26,2.14],[3.96,1.55],[4.22,1.43]],s));
      line(mirror([[2.84,.43],[2.98,.77],[2.99,1.01],[3.22,1.29]],s));
      line(mirror([[1.72,-1.13],[1.82,-.74],[2.04,-.54],[2.07,-.12],[2.23,.03],[2.3,.65],[2.53,.85]],s),'rgba(76,94,103,.3)',.008);
      poly(mirror([[1.38,.56],[1.66,.81],[1.55,1.06],[1.28,.83]],s),'#c8d0d3','rgba(86,102,110,.5)',.01);
      poly(mirror(tailOutline,s),'#adb8bf','#cad2d6',.07);
      line(mirror([[1.19,3.10],[2.53,3.77],[2.77,4.20],[2.72,4.66],[1.38,5.10],[1.12,4.31],[1.19,3.10]],s),'rgba(85,106,116,.5)',.012);
      seam(mirror([[1.10,4.20],[1.60,4.17],[1.70,4.27],[2.83,4.19]],s));
      line(mirror([[1.62,3.40],[1.74,3.81],[1.71,4.1]],s),'rgba(88,104,113,.4)',.01);

      // Chevron-shaped radar-absorbing seams on the forward shoulders.
      seam(mirror([[.48,-3.14],[.66,-2.99],[.69,-2.72],[.83,-2.59],[.86,-2.25],[1.06,-2.10],[1.09,-1.79]],s));
      seam(mirror([[.52,-2.60],[.66,-2.39],[.63,-2.24],[.84,-2.02],[.81,-1.89],[.99,-1.69],[.96,-1.56],[1.12,-1.39]],s));
      poly(mirror([[.67,-2.22],[.88,-2.00],[.98,-1.63],[.90,-1.51],[.67,-1.83]],s),'#8799a2','rgba(199,210,216,.60)',.018);
      line(mirror([[.83,-1.27],[.86,-.28],[.98,-.12],[1.02,.99],[.91,1.16],[.89,2.58],[.98,2.83],[.95,3.75]],s),'rgba(73,93,102,.54)',.012);
      line(mirror([[.48,-.91],[.44,-.56],[.51,-.44],[.47,-.26],[.52,-.12],[.48,.10],[.52,.25],[.46,.42],[.50,.57],[.48,.81]],s),'rgba(202,213,219,.60)',.019);
      line(mirror([[.46,1.20],[.39,1.4],[.45,1.55],[.39,1.72],[.44,1.91],[.38,2.12],[.39,3.68]],s),'rgba(204,216,221,.52)',.015);

      // Small flush access panels. Their screws are painted, not extra draw calls.
      for (const [x,z,w,h] of [[.70,-.77,.21,.38],[.98,.18,.17,.36],[.86,1.47,.23,.42],[.61,2.59,.23,.40]]) {
        const pts = [[x-w/2,z-h/2],[x+w/2,z-h/2],[x+w/2+.04,z-h/2+.07],[x+w/2,z+h/2],[x-w/2,z+h/2]];
        poly(mirror(pts,s),'rgba(213,222,225,.22)','rgba(71,93,104,.58)',.009);
        screw(s*(x-w*.34),z-h*.32); screw(s*(x+w*.32),z+h*.32);
      }
      for (let i=0;i<10;i++) screw(s*(1.35+i*.27),2.61-i*.095,.006);
      stencil('NO STEP',s*2.1,1.65,.055);
      stencil('NO STEP',s*1.84,4.70,.046);
      // The slim pale yellow wingtip strips seen on the RC reference.
      line(mirror([[3.83,1.47],[4.18,1.35]],s),'#e5e6c5',.046);
      line(mirror([[3.83,1.44],[4.18,1.32]],s),'#5f6e71',.011);
    }

    // The radome joint uses a restrained zigzag like the photographed foam model.
    for (const z of [-5.15,-4.98]) {
      seam([[-.36,z+.04],[-.27,z-.04],[-.18,z+.035],[-.09,z-.045],[0,z+.025],[.09,z-.045],[.18,z+.035],[.27,z-.04],[.36,z+.04]]);
    }
    line([[0,-6.18],[0,-5.25]],'rgba(84,101,109,.32)',.009);
    poly([[-.06,-4.73],[.06,-4.73],[.06,-4.64],[-.06,-4.64]],'#536871');
    const hatch=[[-.34,-1.91],[.27,-1.91],[.34,-1.82],[.34,-.51],[.23,-.42],[-.31,-.42],[-.37,-.51],[-.37,-1.80]];
    poly(hatch,'rgba(219,226,229,.20)','rgba(80,98,108,.62)',.011);
    seam([[-.35,-1.77],[-.24,-1.77],[-.20,-1.68],[-.13,-1.77],[-.05,-1.68],[.03,-1.77],[.11,-1.68],[.19,-1.77],[.33,-1.77]]);
    line([[-.28,-.53],[-.28,-1.61],[.27,-1.61],[.27,-.53]],'rgba(205,217,222,.65)',.009);
    for(const x of [-.22,.21]) for(const z of [-1.68,-.58]) screw(x,z,.011);
    poly([[-.07,-1.5],[.07,-1.5],[.07,-1.16],[-.07,-1.16]],'#899da6');
    poly([[-.1,-.2],[.08,-.2],[.13,-.02],[0,.10],[-.13,-.02]],'#bfcbd0','rgba(80,101,113,.65)',.014);
    seam([[-.55,.31],[-.43,.31],[-.37,.42],[-.28,.31],[-.20,.42],[-.11,.31],[0,.42],[.11,.31],[.20,.42],[.28,.31],[.37,.42],[.43,.31],[.55,.31]]);
    poly([[-.12,1.33],[.12,1.33],[.12,1.62],[.07,1.67],[-.08,1.67],[-.12,1.62]],'#495b63');
    line([[0,1.79],[0,4.20]],'rgba(83,105,117,.4)',.012);
    stencil('RESCUE',.43,-3.36,.05,Math.PI/2);

    // Low-visibility white star and bars, as visible on the photographed wing.
    c.save(); c.translate(px(3.35),pz(1.12)); c.rotate(-.30);
    const rr=.18*sx;
    c.fillStyle='#d5dedd'; c.strokeStyle='#d5dedd'; c.lineWidth=rr*.17;
    c.strokeRect(-rr*1.65,-rr*.25,rr*3.3,rr*.5);
    c.beginPath(); c.arc(0,0,rr,0,Math.PI*2); c.stroke();
    c.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?rr*.39:rr*.84; i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
    c.closePath();c.fill();c.restore();
  });

  const grainTexture = canvasTexture(256,256,(c,W,H) => {
    const pixels=c.createImageData(W,H); let state=97;
    for(let i=0;i<pixels.data.length;i+=4){state=(state*16807)%2147483647; const a=(state%7)-3; pixels.data[i]=128+a;pixels.data[i+1]=128-a;pixels.data[i+2]=255;pixels.data[i+3]=255;}
    c.putImageData(pixels,0,0);
  });
  if(grainTexture){grainTexture.colorSpace=THREE.NoColorSpace;grainTexture.wrapS=grainTexture.wrapT=THREE.RepeatWrapping;grainTexture.repeat.set(7,7);}

  // Broad changes of sheen follow service panels. There is deliberately no
  // coarse metallic sparkle: the reference is a coated silver-gray airframe.
  const roughnessTexture = canvasTexture(1024,1024,(c,W,H)=>{
    c.fillStyle='#dfdfdf';c.fillRect(0,0,W,H);
    let state=2017;
    const rand=()=>{state=(state*16807)%2147483647;return state/2147483647;};
    for(let i=0;i<100;i++){
      const level=210+Math.floor(rand()*24);c.fillStyle=`rgb(${level},${level},${level})`;
      c.fillRect(rand()*W,rand()*H,30+rand()*120,70+rand()*210);
    }
    const g=c.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(255,255,255,.04)');g.addColorStop(.5,'rgba(100,100,100,.035)');g.addColorStop(1,'rgba(255,255,255,.04)');
    c.fillStyle=g;c.fillRect(0,0,W,H);
  });
  if(roughnessTexture)roughnessTexture.colorSpace=THREE.NoColorSpace;

  materials.skin = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: topTexture, roughnessMap: roughnessTexture, metalness: .52, roughness: .57,
    normalMap: grainTexture, normalScale: new THREE.Vector2(.045,.045), envMapIntensity: .85
  });
  if(!topTexture) materials.skin.color.set(0xb0b9bd);
  materials.belly = new THREE.MeshStandardMaterial({color:0x8e9da5,metalness:.44,roughness:.56,normalMap:grainTexture,normalScale:new THREE.Vector2(.035,.035)});
  materials.edge = new THREE.MeshStandardMaterial({color:0xb8c2c8,metalness:.48,roughness:.48});
  materials.trim = new THREE.MeshStandardMaterial({color:0x798991,metalness:.59,roughness:.44});
  materials.dark = new THREE.MeshStandardMaterial({color:0x111b21,metalness:.15,roughness:.71});
  materials.black = new THREE.MeshStandardMaterial({color:0x070c11,metalness:.04,roughness:.88});
  materials.rubber = new THREE.MeshStandardMaterial({color:0x26323a,roughness:.85});
  materials.exhaust = new THREE.MeshStandardMaterial({color:0x727b7c,metalness:.83,roughness:.43});
  materials.nozzleInterior = new THREE.MeshStandardMaterial({color:0x474944,metalness:.71,roughness:.66});
  materials.glass = new THREE.MeshPhysicalMaterial({color:0xc7d5d1,metalness:0,roughness:.045,transparent:true,opacity:.28,transmission:.48,thickness:.025,ior:1.45,clearcoat:1,clearcoatRoughness:.04,side:THREE.DoubleSide,envMapIntensity:1.25,depthWrite:false});

  function projectedUV(geometry) {
    const p=geometry.attributes.position, uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)+mapBounds.x)/(2*mapBounds.x);uv[i*2+1]=1-(p.getZ(i)-mapBounds.z0)/(mapBounds.z1-mapBounds.z0);}
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
  }
  function indexedGeometry(positions,indices,uvs) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);
    if(uvs) geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals(); return geometry;
  }
  function smoothProfile(rows,z,col){
    let i=0; while(i<rows.length-2 && rows[i+1][0]<z)i++;
    const a=rows[i],b=rows[i+1],t=clamp((z-a[0])/(b[0]-a[0]),0,1),h=b[0]-a[0];
    const prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)];
    const ma=(b[col]-prev[col])/(b[0]-prev[0]),mb=(next[col]-a[col])/(next[0]-a[0]);
    return (2*t*t*t-3*t*t+1)*a[col]+(t*t*t-2*t*t+t)*h*ma+(-2*t*t*t+3*t*t)*b[col]+(t*t*t-t*t)*h*mb;
  }

  const bodyRows = [
    [-6.24,.012,-.005,-.035],[-6.02,.13,.055,-.13],[-5.58,.29,.19,-.26],
    [-5.05,.41,.32,-.36],[-4.48,.49,.40,-.41],[-3.78,.59,.46,-.46],
    [-3.03,.76,.48,-.52],[-2.34,1.04,.52,-.59],[-1.44,1.29,.54,-.64],
    [-.28,1.47,.49,-.67],[1.05,1.46,.45,-.63],[2.25,1.39,.40,-.59],
    [3.45,1.24,.34,-.53],[4.22,1.12,.23,-.40],[4.57,1.04,.15,-.31]
  ];
  const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const bodyWidth=z=>Math.max(.008,smoothProfile(bodyRows,z,1));
  const bodyTop=(x,z)=>{
    const width=bodyWidth(z),u=clamp(Math.abs(x)/width,0,1);
    const top=smoothProfile(bodyRows,z,2),chine=Math.min(.055,top*.15);
    const engine=ease((z+.85)/1.45)*ease((4.57-z)/.70);
    const hump=.19*engine*(Math.exp(-Math.pow((x-.64)/.37,2))+Math.exp(-Math.pow((x+.64)/.37,2)));
    return chine+(top-chine)*Math.pow(Math.max(0,1-Math.pow(u,3)),.55)+hump;
  };
  const bodyBottom=(x,z)=>{
    const width=bodyWidth(z),u=clamp(Math.abs(x)/width,0,1);
    const bottom=smoothProfile(bodyRows,z,3);
    return -.035+(bottom+.035)*Math.pow(Math.max(0,1-u*u),.42);
  };

  const canopyRows=[
    [-4.76,.014,.414,.435],[-4.55,.19,.45,.70],[-4.22,.285,.475,.98],
    [-3.78,.325,.495,1.16],[-3.29,.330,.514,1.21],[-2.84,.292,.535,1.12],
    [-2.47,.198,.55,.84],[-2.28,.018,.56,.59]
  ];

  function bodySurface(top){
    const p=[],idx=[],nz=110,nx=56;
    for(let j=0;j<=nz;j++){
      const z=mix(bodyRows[0][0],bodyRows.at(-1)[0],j/nz),width=bodyWidth(z);
      for(let i=0;i<=nx;i++){const x=width*(i/nx*2-1);p.push(x,top?bodyTop(x,z):bodyBottom(x,z),z);}
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const a=j*(nx+1)+i,b=a+1,d=a+nx+1,e=d+1;
      const tris=top?[a,d,b,b,d,e]:[a,b,d,b,e,d];
      for(let k=0;k<6;k+=3){
        const ids=tris.slice(k,k+3);
        const cx=ids.reduce((sum,id)=>sum+p[id*3],0)/3;
        const cz=ids.reduce((sum,id)=>sum+p[id*3+2],0)/3;
        const inOpening=top&&cz> -4.67&&cz< -2.40&&Math.abs(cx)<smoothProfile(canopyRows,cz,1)*.97;
        if(!inOpening)idx.push(...ids);
      }
    }
    return projectedUV(indexedGeometry(p,idx));
  }
  mesh('Fuselage • upper silver skin',bodySurface(true),materials.skin);
  mesh('Fuselage • lower chined skin',bodySurface(false),materials.belly);

  for(const s of [-1,1]){
    const p=[],idx=[],n=110;
    for(let j=0;j<=n;j++){
      const z=mix(bodyRows[0][0],bodyRows.at(-1)[0],j/n),x=s*bodyWidth(z);
      p.push(x,bodyTop(x,z),z,x,bodyBottom(x,z),z);
    }
    for(let j=0;j<n;j++){let a=j*2;if(s>0)idx.push(a,a+2,a+1,a+1,a+2,a+3);else idx.push(a,a+1,a+2,a+1,a+3,a+2);}
    mesh(`Fuselage • ${s<0?'left':'right'} chine`,projectedUV(indexedGeometry(p,idx)),materials.edge);
  }
  {
    const z=4.57,p=[],idx=[],n=56,w=bodyWidth(z);
    for(let i=0;i<=n;i++){const x=w*(i/n*2-1);p.push(x,bodyTop(x,z),z,x,bodyBottom(x,z),z);}
    for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}
    mesh('Aft fuselage closure',projectedUV(indexedGeometry(p,idx)),materials.trim);
  }
  {
    const z=bodyRows[0][0],p=[],idx=[],n=8,w=bodyWidth(z);
    for(let i=0;i<=n;i++){const x=w*(i/n*2-1);p.push(x,bodyTop(x,z),z,x,bodyBottom(x,z),z);}
    for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    mesh('Nose • closed tip',projectedUV(indexedGeometry(p,idx)),materials.skin);
  }

  // Thin, genuinely cambered wing sections with a pointed leading/trailing edge.
  const wingRows=[
    [.85,-2.44,2.60,.19],[1.4,-1.98,2.75,.16],[2.3,-1.04,2.48,.125],
    [3.3,.04,2.11,.085],[4.25,1.00,1.78,.045],[4.38,1.22,1.62,.024]
  ];
  function wingHeight(x,z,upper){
    const lead=smoothProfile(wingRows,x,1),trail=smoothProfile(wingRows,x,2),u=clamp((z-lead)/(trail-lead),0,1);
    const section=(span,zz)=>{
      const le=smoothProfile(wingRows,span,1),tr=smoothProfile(wingRows,span,2),t=clamp((zz-le)/(tr-le),0,1);
      return .035-.025*(span-.85)/3.53+(upper?1:-.67)*smoothProfile(wingRows,span,3)*Math.pow(Math.sin(t*Math.PI),.69);
    };
    const basic=section(x,z),width=bodyWidth(z),start=width*.66,end=width+.75;
    if(x>=end)return basic;
    // A tangent-matched fillet carries the fuselage shoulder into the airfoil.
    // It becomes exactly the original thin wing section at the outer boundary.
    const t=clamp((x-start)/(end-start),0,1),h=end-start,surface=upper?bodyTop:bodyBottom;
    const y0=surface(start,z),y1=section(end,z);
    const m0=(surface(start+.012,z)-surface(start-.012,z))/.024;
    const m1=(section(end+.012,z)-section(end-.012,z))/.024;
    const fillet=(2*t*t*t-3*t*t+1)*y0+(t*t*t-2*t*t+t)*h*m0+(-2*t*t*t+3*t*t)*y1+(t*t*t-t*t)*h*m1;
    const chordFade=Math.pow(Math.max(0,Math.sin(Math.PI*u)),.32);
    return basic+(fillet-basic)*chordFade;
  }
  function wingSurface(s,upper){
    const p=[],idx=[],ns=60,nc=40;
    for(let i=0;i<=ns;i++){
      const x=mix(.85,4.38,i/ns),lead=smoothProfile(wingRows,x,1),trail=smoothProfile(wingRows,x,2);
      for(let j=0;j<=nc;j++){
        const z=mix(lead,trail,j/nc);p.push(s*x,wingHeight(x,z,upper),z);
      }
    }
    for(let i=0;i<ns;i++)for(let j=0;j<nc;j++){
      const a=i*(nc+1)+j,b=a+1,d=a+nc+1,e=d+1;
      if((s>0)===upper)idx.push(a,b,d,b,e,d);else idx.push(a,d,b,b,d,e);
    }
    return projectedUV(indexedGeometry(p,idx));
  }
  for(const s of [-1,1]){
    const side=s<0?'left':'right';
    mesh(`Wing • ${side} upper airfoil`,wingSurface(s,true),materials.skin);
    mesh(`Wing • ${side} lower airfoil`,wingSurface(s,false),materials.belly);
    const p=[],idx=[],n=30;
    for(let j=0;j<=n;j++){
      const u=j/n,z=mix(1.22,1.62,u),shape=Math.pow(Math.sin(u*Math.PI),.69);
      p.push(s*4.38,.01+.024*shape,z,s*4.38,.01-.024*.67*shape,z);
    }
    for(let j=0;j<n;j++){
      const a=j*2;
      if(j>0){if(s>0)idx.push(a,a+2,a+1);else idx.push(a,a+1,a+2);}
      if(j<n-1){if(s>0)idx.push(a+1,a+2,a+3);else idx.push(a+1,a+3,a+2);}
    }
    const tipGeometry=indexedGeometry(p,idx);
    for(let i=0;i<tipGeometry.attributes.normal.count;i++)tipGeometry.attributes.normal.setXYZ(i,s,0,0);
    mesh(`Wing • ${side} closed tip`,tipGeometry,materials.edge);
  }

  function plateFromOutline(name,outline,y,thickness,parent=aircraft){
    const shape=new THREE.Shape();
    outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.014,bevelThickness:.009,curveSegments:1});
    g.rotateX(-Math.PI/2);g.translate(0,y-thickness/2,0);projectedUV(g);
    return mesh(name,g,materials.skin,parent);
  }
  for(const s of [-1,1]){
    const side=s<0?'left':'right';
    const pivot=new THREE.Group();pivot.name=`tailplane-${side}`;pivot.position.set(s*1.05,.16,3.9);aircraft.add(pivot);
    const part=plateFromOutline(`Horizontal stabilizer • ${side}`,tailOutline.map(([x,z])=>[s*x,z]),.16,.065,pivot);
    part.geometry.translate(-pivot.position.x,-pivot.position.y,-pivot.position.z);
    pivot.userData.hingeAxis='local X';
  }

  // A real recessed cockpit, with a rear-hinged bubble canopy and seated pilot.
  function canopySurface(){
    const p=[],idx=[],uv=[],nz=64,nx=44;
    for(let j=0;j<=nz;j++){
      const z=mix(-4.76,-2.28,j/nz),w=smoothProfile(canopyRows,z,1),base=smoothProfile(canopyRows,z,2),top=smoothProfile(canopyRows,z,3);
      for(let i=0;i<=nx;i++){
        const a=Math.PI*i/nx,x=-Math.cos(a)*w,y=base+Math.sin(a)*(top-base);
        p.push(x,y,z);uv.push(i/nx,j/nz);
      }
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,d=a+nx+1,e=d+1;idx.push(a,d,b,b,d,e);}
    return indexedGeometry(p,idx,uv);
  }
  function tube(name,points,radius,material,parent=aircraft,closed=false,radial=6){
    const curve=new THREE.CatmullRomCurve3(points.map(vec),closed,'centripetal');
    return mesh(name,new THREE.TubeGeometry(curve,Math.max(16,points.length*5),radius,radial,closed),material,parent);
  }
  function box(name,w,h,d,x,y,z,mat,parent=aircraft){const o=mesh(name,new THREE.BoxGeometry(w,h,d),mat,parent);o.position.set(x,y,z);return o;}
  function paddedBox(name,w,h,d,x,y,z,mat,radius=.012){
    // Round the corners without changing the specified outer dimensions.
    const segments=5,g=new THREE.BoxGeometry(1,1,1,segments,segments,segments);
    const positions=g.attributes.position,normals=g.attributes.normal,n=new THREE.Vector3();
    const r=Math.min(radius,w/2,h/2,d/2),half=[w/2-r,h/2-r,d/2-r];
    for(let i=0;i<positions.count;i++){
      const p=[positions.getX(i),positions.getY(i),positions.getZ(i)];
      n.set(...p.map(v=>Math.sign(v)*Math.max(0,Math.abs(v)-.5/segments))).normalize();
      positions.setXYZ(i,Math.sign(p[0])*half[0]+n.x*r,Math.sign(p[1])*half[1]+n.y*r,Math.sign(p[2])*half[2]+n.z*r);
      normals.setXYZ(i,n.x,n.y,n.z);
    }
    const o=mesh(name,g,mat);o.position.set(x,y,z);return o;
  }
  const canopyHinge=new THREE.Group();canopyHinge.name='canopy-hinge';canopyHinge.position.set(0,.56,-2.28);aircraft.add(canopyHinge);
  canopyHinge.userData={closedAngle:0,openAngle:1.05,axis:'X'};
  const canopyAssembly=new THREE.Group();canopyAssembly.name='Canopy assembly';canopyAssembly.position.set(0,-.56,2.28);canopyHinge.add(canopyAssembly);
  const sillPts=[];
  for(let i=0;i<=40;i++){
    const z=mix(-4.76,-2.28,i/40),w=smoothProfile(canopyRows,z,1),y=smoothProfile(canopyRows,z,2);
    sillPts.push([-w-.012,y+.007,z]);
  }
  for(let i=40;i>=0;i--){
    const z=mix(-4.76,-2.28,i/40),w=smoothProfile(canopyRows,z,1),y=smoothProfile(canopyRows,z,2);
    sillPts.push([w+.012,y+.007,z]);
  }
  tube('Cockpit • fixed weather seal',sillPts.map(([x,y,z])=>[x,y-.018,z]),.016,materials.dark,aircraft,true,8);
  {
    // A closed collar bridges the raised sill to the actual fuselage surface.
    // Its inner lip overlaps the roof cut, and the lining reaches into the tub;
    // continuous end bridges also cover the cut's fore/aft triangle steps.
    const perimeterSteps=176,centerZ=-3.52;
    const collarLoop=(front,rear,widthAt,heightAt)=>{
      const ring=[];
      // All loops share radial directions, so their tapered ends cannot fold.
      for(let i=0;i<perimeterSteps;i++){
        const a=i/perimeterSteps*Math.PI*2,dx=-Math.sin(a)*.38,dz=-Math.cos(a)*1.30;
        let low=0,high=2;
        for(let step=0;step<30;step++){
          const t=(low+high)/2,z=centerZ+dz*t;
          if(z>=front&&z<=rear&&Math.abs(dx*t)<=widthAt(z))low=t;else high=t;
        }
        const t=(low+high)/2,x=dx*t,z=centerZ+dz*t;
        ring.push([x,heightAt(x,z),z]);
      }
      return ring;
    };
    const width=z=>smoothProfile(canopyRows,z,1),sill=z=>smoothProfile(canopyRows,z,2);
    const apertureWidth=z=>Math.max(.020,width(z)*.97-.037);
    const rings=[
      collarLoop(-4.82,-2.22,z=>width(z)+.070,(x,z)=>bodyTop(x,z)-.006),
      collarLoop(-4.79,-2.25,z=>width(z)+.048,(x,z)=>bodyTop(x,z)+.012),
      collarLoop(-4.76,-2.28,z=>width(z)+.012,(x,z)=>sill(z)-.020),
      collarLoop(-4.60,-2.48,apertureWidth,(x,z)=>sill(z)-.020),
      collarLoop(-4.60,-2.48,apertureWidth,()=>-.080)
    ];
    const p=rings.flat(2),idx=[],groups=[],count=rings[0].length;
    for(let row=0;row<rings.length;row++){
      const start=idx.length,next=(row+1)%rings.length;
      for(let i=0;i<count;i++){
        const j=(i+1)%count,a=row*count+i,b=row*count+j,c=next*count+i,d=next*count+j;
        idx.push(a,b,c,b,d,c);
      }
      groups.push([start,idx.length-start,row<3?0:1]);
    }
    const g=indexedGeometry(p,idx);
    for(const [start,count,material]of groups)g.addGroup(start,count,material);
    mesh('Cockpit • closed silver sill collar',g,[materials.edge,materials.dark]);
  }
  tube('Canopy • silver perimeter frame',sillPts,.019,materials.edge,canopyAssembly,true,8);
  const canopy=mesh('Canopy • clear smoke-tinted bubble',canopySurface(),materials.glass,canopyAssembly);canopy.renderOrder=4;
  const rearBow=[];for(let i=0;i<=24;i++){const a=Math.PI*i/24;rearBow.push([-.200*Math.cos(a),.55+.29*Math.sin(a),-2.47]);}
  tube('Canopy • rear structural bow',rearBow,.012,materials.trim,canopyAssembly);
  // The tub lies below the fuselage surface. Its opening is cut into the upper skin.
  {
    const p=[],idx=[],nz=48,nx=10;
    for(let j=0;j<=nz;j++){
      const z=mix(-4.66,-2.40,j/nz),w=smoothProfile(canopyRows,z,1)*.96;
      for(let i=0;i<=nx;i++)p.push((i/nx*2-1)*w,-.075,z);
    }
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,d=a+nx+1,e=d+1;idx.push(a,d,b,b,d,e);}
    mesh('Cockpit • recessed floor',indexedGeometry(p,idx),materials.dark);
    for(const s of [-1,1]){
      const points=[],indices=[];
      for(let j=0;j<=nz;j++){const z=mix(-4.66,-2.40,j/nz),x=s*smoothProfile(canopyRows,z,1)*.97,y=smoothProfile(canopyRows,z,2)-.019;points.push(x,y,z,x,-.075,z);}
      for(let j=0;j<nz;j++){const a=j*2;if(s>0)indices.push(a,a+1,a+2,a+1,a+3,a+2);else indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      mesh(`Cockpit • ${s<0?'left':'right'} inner wall`,indexedGeometry(points,indices),materials.dark);
    }
  }
  const seatMat=new THREE.MeshStandardMaterial({color:0x333f3a,roughness:.86,metalness:.05});
  const seatPad=new THREE.MeshStandardMaterial({color:0x4b5146,roughness:.94});
  const hardware=new THREE.MeshStandardMaterial({color:0x7b8582,metalness:.72,roughness:.30});
  const yellow=new THREE.MeshStandardMaterial({color:0xdab343,metalness:.05,roughness:.54});
  paddedBox('Cockpit • seat pan',.355,.085,.43,0,.255,-3.16,seatMat);
  paddedBox('Cockpit • padded seat cushion',.31,.07,.38,0,.313,-3.18,seatPad,.014);
  const seatBack=paddedBox('Cockpit • ejection seat back',.34,.62,.095,0,.61,-2.965,seatMat);seatBack.rotation.x=-.11;
  const backPad=paddedBox('Cockpit • backrest padding',.285,.47,.05,0,.61,-3.025,seatPad,.014);backPad.rotation.x=-.11;
  paddedBox('Cockpit • cushioned headrest',.18,.13,.09,0,.995,-2.966,seatMat,.014);
  for(const s of [-1,1]){
    box(`Cockpit • seat rail ${s}`,.022,.66,.035,s*.164,.54,-2.92,hardware);
    box(`Cockpit • ${s<0?'left':'right'} console`,.095,.15,.72,s*.24,.385,-3.49,materials.black);
    box(`Cockpit • console upper pad ${s}`,.10,.022,.70,s*.24,.471,-3.49,seatMat);
    for(let i=0;i<5;i++){
      const switchMesh=mesh(`Cockpit • console switch ${s} ${i}`,new THREE.CylinderGeometry(.004,.006,.020,6),hardware);switchMesh.position.set(s*.24,.489,-3.69+i*.068);switchMesh.rotation.z=s*.16;
    }
  }
  tube('Cockpit • ejection loop',[[-.063,1.055,-2.92],[-.068,1.115,-2.92],[0,1.13,-2.92],[.068,1.115,-2.92],[.063,1.055,-2.92]],.008,yellow);
  // Display graphics are embedded canvas textures and remain inside the GLB.
  const displayMap=canvasTexture(768,300,(c,W,H)=>{
    c.fillStyle='#101c20';c.fillRect(0,0,W,H);
    const panels=[[22,28,220,204],[274,28,220,204],[526,28,220,204]];
    for(const [x,y,w,h]of panels){c.fillStyle='#050c0e';c.fillRect(x,y,w,h);c.strokeStyle='#758982';c.lineWidth=2;c.strokeRect(x,y,w,h);}
    c.save();c.beginPath();c.rect(34,39,196,180);c.clip();c.fillStyle='#254551';c.fillRect(34,39,196,85);c.fillStyle='#5a5746';c.fillRect(34,124,196,100);c.strokeStyle='#dcdfcf';c.lineWidth=2;c.beginPath();c.moveTo(48,124);c.lineTo(218,124);c.stroke();
    c.strokeStyle='#bccabf';for(let i=-2;i<=2;i++){c.beginPath();c.moveTo(111,124+i*23);c.lineTo(155,124+i*23);c.stroke();}c.restore();
    c.strokeStyle='#6bba97';c.lineWidth=2;for(let i=1;i<4;i++){c.beginPath();c.arc(384,132,i*22,0,Math.PI*2);c.stroke();}c.beginPath();c.moveTo(384,53);c.lineTo(384,206);c.moveTo(303,132);c.lineTo(466,132);c.stroke();c.fillStyle='#e0d28d';c.beginPath();c.moveTo(384,112);c.lineTo(377,137);c.lineTo(391,137);c.closePath();c.fill();
    c.font='17px monospace';c.fillStyle='#9cc6b3';c.fillText('NAV',548,56);c.fillText('SYS  OK',548,90);c.fillText('FUEL  82%',548,124);c.fillText('ENG  READY',548,158);c.fillText('SAFE',548,193);
    c.font='13px monospace';c.fillStyle='#b2beb2';for(let i=0;i<3;i++){c.fillText(['PFD','NAV','STATUS'][i],78+i*252,260);for(let k=0;k<5;k++){c.fillStyle='#626e69';c.fillRect(35+i*252+k*41,275,18,8);}}
  });
  const displayMat=new THREE.MeshStandardMaterial({color:0xffffff,map:displayMap,emissive:0x335d50,emissiveMap:displayMap,emissiveIntensity:.35,roughness:.38,metalness:.05});
  const board=box('Cockpit • instrument panel',.50,.235,.075,0,.600,-3.895,materials.black);board.rotation.x=-.15;
  const display=mesh('Cockpit • multifunction displays',new THREE.PlaneGeometry(.464,.181),displayMat);display.position.set(0,.606,-3.851);display.rotation.x=-.15;
  for(const s of [-1,1]){
    const knob=mesh(`Cockpit • panel selector ${s}`,new THREE.CylinderGeometry(.016,.016,.015,12),hardware);knob.rotation.x=Math.PI/2;knob.position.set(s*.207,.511,-3.845);
  }
  const coaming=box('Cockpit • instrument coaming',.53,.038,.12,0,.738,-3.91,seatMat);coaming.rotation.x=-.12;
  const controlStick=mesh('Cockpit • control stick',new THREE.CylinderGeometry(.010,.015,.12,10),materials.dark);controlStick.position.set(.16,.489,-3.50);controlStick.rotation.z=-.12;
  box('Cockpit • control stick grip',.030,.060,.043,.16,.557,-3.50,materials.rubber);
  box('Cockpit • throttle quadrant',.045,.045,.07,-.22,.486,-3.44,hardware);
  box('Cockpit • throttle grip',.045,.025,.045,-.22,.516,-3.44,materials.rubber);
  const hud=mesh('Cockpit • HUD combiner',new THREE.PlaneGeometry(.145,.115),new THREE.MeshPhysicalMaterial({color:0xa0ccb7,transparent:true,opacity:.20,side:THREE.DoubleSide,metalness:0,roughness:.07,transmission:.25}));hud.position.set(0,.83,-4.02);hud.rotation.x=-.18;hud.renderOrder=2;
  for(const s of [-1,1])tube(`Cockpit • HUD support ${s}`,[[s*.065,.74,-4.04],[s*.065,.83,-4.015]],.005,hardware);
  const pilot=createPilot(THREE);pilot.position.set(0,.39,-3.17);aircraft.add(pilot);
  aircraft.userData.cockpitFocus=[0,.88,-3.18];
  aircraft.userData.canopyHinge='canopy-hinge';


  // Intakes have separate lips, dark interior walls and recessed back surfaces.
  // Their swept mouths sit outside the forebody, leaving the cavity visible.
  function orientedQuad(positions,indices,corners,hint){
    const base=positions.length/3;
    corners.forEach(p=>positions.push(...p));
    const normal=vec(corners[1]).sub(vec(corners[0])).cross(vec(corners[2]).sub(vec(corners[0])));
    if(normal.dot(vec(hint))>=0)indices.push(base,base+1,base+2,base,base+2,base+3);
    else indices.push(base,base+2,base+1,base,base+3,base+2);
  }
  function ringSurface(outer,inner,name,material,orientation='outward'){
    const p=[],idx=[],center=outer.concat(inner).reduce((a,b)=>a.map((v,k)=>v+b[k]/(outer.length+inner.length)),[0,0,0]);
    for(let i=0;i<outer.length;i++){
      const j=(i+1)%outer.length,corners=[outer[i],outer[j],inner[j],inner[i]];
      const mid=corners.reduce((a,b)=>a.map((v,k)=>v+b[k]/4),[0,0,0]);
      const sign=orientation==='inward'?-1:1;
      const hint=orientation==='front'?[0,0,-1]:orientation==='rear'?[0,0,1]:[(mid[0]-center[0])*sign,(mid[1]-center[1])*sign,0];
      orientedQuad(p,idx,corners,hint);
    }
    return mesh(name,projectedUV(indexedGeometry(p,idx)),material);
  }
  function polygon3(points,name,material,orientation='front'){
    const p=[],idx=[];for(let i=1;i<points.length-1;i++){
      const q=[points[0],points[i],points[i+1]],base=p.length/3;q.forEach(v=>p.push(...v));
      const n=vec(q[1]).sub(vec(q[0])).cross(vec(q[2]).sub(vec(q[0])));
      const dir=orientation==='front'?-1:1;if(n.z*dir>=0)idx.push(base,base+1,base+2);else idx.push(base,base+2,base+1);
    }
    return mesh(name,projectedUV(indexedGeometry(p,idx)),material);
  }
  const lipMaterial=materials.edge.clone();lipMaterial.roughness=.39;lipMaterial.metalness=.6;
  const inletMaterial=new THREE.MeshStandardMaterial({color:0x4d5a61,metalness:.44,roughness:.63});
  for(const s of [-1,1]){
    const side=s<0?'left':'right';
    const outer=[[.79,.17,-2.73],[1.27,.22,-2.46],[1.45,-.48,-2.34],[.86,-.61,-2.67]].map(([x,y,z])=>[s*x,y,z]);
    const inner=[[.85,.11,-2.67],[1.23,.15,-2.47],[1.37,-.425,-2.37],[.915,-.535,-2.64]].map(([x,y,z])=>[s*x,y,z]);
    const bevel=outer.map((p,i)=>p.map((v,k)=>mix(v,inner[i][k],.4)+(k===2?-.012:0)));
    ringSurface(outer,bevel,`Intake • ${side} machined lip bevel`,materials.trim,'front');
    ringSurface(bevel,inner,`Intake • ${side} silver inlet rim`,lipMaterial,'front');
    const bend=inner.map(([x,y,z])=>[x+s*.045,y+.012,z+.42]);
    const throat=inner.map(([x,y,z])=>[x+s*.075,y+.035,z+.88]);
    ringSurface(inner,bend,`Intake • ${side} first duct section`,inletMaterial,'inward');
    ringSurface(bend,throat,`Intake • ${side} deep duct section`,materials.dark,'inward');
    polygon3(throat,`Intake • ${side} recessed opening`,materials.black,'front');
    const middle=[[s*.92,.19,-1.72],[s*1.43,.20,-1.56],[s*1.51,-.45,-1.49],[s*.94,-.60,-1.68]];
    const rear=[[s*.99,.13,-.6],[s*1.49,.13,-.47],[s*1.51,-.42,-.45],[s*.99,-.58,-.6]];
    ringSurface(outer,middle,`Intake • ${side} front fairing`,materials.belly,'outward');
    ringSurface(middle,rear,`Intake • ${side} rear fairing`,materials.belly,'outward');
    const ramp=[inner[0],inner[1],[inner[1][0],inner[1][1]-.075,inner[1][2]+.34],[inner[0][0],inner[0][1]-.075,inner[0][2]+.34]];
    const pp=[],ii=[];orientedQuad(pp,ii,ramp,[0,-1,0]);mesh(`Intake • ${side} splitter ramp`,projectedUV(indexedGeometry(pp,ii)),materials.trim);
    tube(`Intake • ${side} splitter boundary`,[inner[0],bend[0]],.009,materials.dark,aircraft,false,4);
  }

  // Canted fins: a true thin closed solid, with their own non-repeating panel map.
  const finContour=[[0,0],[1.13,1.85],[2.18,1.98],[3.13,.15],[2.78,0]]; // [z,y] relative to root
  const finTexture=canvasTexture(1024,1024,(c,W,H)=>{
    const px=z=>z/3.3*W,py=y=>(2.15-y)/2.15*H;
    c.fillStyle='#aeb9bf';c.fillRect(0,0,W,H);
    const path=pts=>{c.beginPath();pts.forEach(([z,y],i)=>i?c.lineTo(px(z),py(y)):c.moveTo(px(z),py(y)));c.closePath();};
    path([[.08,.04],[1.17,1.76],[2.12,1.89],[3.01,.20],[2.73,.08]]);c.strokeStyle='#c7d1d6';c.lineWidth=11;c.stroke();
    path([[.20,.1],[1.24,1.65],[1.95,1.78],[1.51,.65],[1.10,.15]]);c.fillStyle='rgba(126,145,155,.24)';c.fill();
    path([[1.97,1.75],[2.13,1.86],[2.97,.23],[2.7,.13],[2.01,.13],[1.8,.36]]);c.fillStyle='rgba(204,214,219,.42)';c.fill();
    c.beginPath();c.moveTo(px(2.11),py(1.85));c.lineTo(px(1.91),py(1.38));c.lineTo(px(2.03),py(1.29));c.lineTo(px(1.64),py(.37));c.lineTo(px(1.72),py(.24));c.lineTo(px(1.64),py(.08));c.strokeStyle='#c7d1d7';c.lineWidth=8;c.stroke();c.strokeStyle='rgba(65,88,101,.5)';c.lineWidth=1.7;c.stroke();
    c.beginPath();c.moveTo(px(1.04),py(.47));c.lineTo(px(1.23),py(.61));c.lineTo(px(1.43),py(.58));c.lineTo(px(1.53),py(.84));c.strokeStyle='rgba(68,89,100,.45)';c.lineWidth=3;c.stroke();
    for(const [z,y]of[[2.09,1.48],[1.72,.62]]){
      c.fillStyle='#344750';c.fillRect(px(z)-9,py(y)-18,18,36);
      c.fillStyle='#d3dadd';c.fillRect(px(z)+2,py(y)-14,7,28);
    }
    c.fillStyle='rgba(73,92,103,.58)';c.font='500 17px sans-serif';c.fillText('NO PUSH',px(1.31),py(.34));
  });
  const finMat=new THREE.MeshStandardMaterial({color:0xffffff,map:finTexture,metalness:.49,roughness:.52,normalMap:grainTexture,normalScale:new THREE.Vector2(.04,.04)});
  if(!finTexture)finMat.color.set(0xaeb9bf);

  for(const s of [-1,1]){
    const p=[],uv=[],idx=[],N=finContour.length;
    for(const face of [-1,1])for(const [z,y] of finContour){const thick=mix(.055,.026,y/1.98);p.push(s*(1.02+.28*y)+face*thick,y+.39,z+1.37);uv.push(z/3.3,y/2.15);}
    const tri=THREE.ShapeUtils.triangulateShape(finContour.map(([z,y])=>new THREE.Vector2(z,y)),[]);
    for(const t of tri){idx.push(t[0],t[1],t[2]);idx.push(t[0]+N,t[2]+N,t[1]+N);}
    for(let i=0;i<N;i++){const j=(i+1)%N;idx.push(i,j,i+N,j,j+N,i+N);}
    const geometry=indexedGeometry(p,idx,uv).toNonIndexed();geometry.computeVertexNormals();
    mesh(`Vertical stabilizer • ${s<0?'left':'right'} canted fin`,geometry,finMat);
    const leading=finContour.slice(0,3).map(([z,y])=>[s*(1.02+.28*y),y+.39,z+1.37]);
    tube(`Tail • ${s<0?'left':'right'} pale leading edge`,leading,.010,materials.edge,aircraft,false,5);
  }

  // Twin rectangular vectoring nozzles: each feather is a separate closed
  // metal plate, above a dark seal layer, with real recessed and ribbed walls.
  const nozzleShape=(cx,y,z,w,h)=>[[cx-w/2+.04,y+h/2,z],[cx+w/2-.04,y+h/2,z],[cx+w/2,y+h/2-.04,z],[cx+w/2,y-h/2+.04,z],[cx+w/2-.04,y-h/2,z],[cx-w/2+.04,y-h/2,z],[cx-w/2,y-h/2+.04,z],[cx-w/2,y+h/2-.04,z]];
  const featherMaterials=[0x798183,0x777e7e,0x727879,0x7b8180,0x777d7c,0x747c80,0x7e8382,0x757c7d].map(color=>new THREE.MeshStandardMaterial({color,metalness:.87,roughness:.4}));
  const nozzleSeal=new THREE.MeshStandardMaterial({color:0x394249,metalness:.72,roughness:.53});
  const hotEdge=new THREE.MeshStandardMaterial({color:0x6e6c60,metalness:.84,roughness:.49});
  function feather(name,rows,cx,f0,f1,direction,material){
    const p=[],idx=[];
    for(let j=0;j<rows.length-1;j++){
      const r0=rows[j],r1=rows[j+1],y0=r0[direction>0?1:2],y1=r1[direction>0?1:2];
      const outer=[[cx+(f0-.5)*r0[3],y0,r0[0]],[cx+(f1-.5)*r0[3],y0,r0[0]],[cx+(f1-.5)*r1[3],y1,r1[0]],[cx+(f0-.5)*r1[3],y1,r1[0]]];
      const inside=outer.map(v=>[v[0],v[1]-direction*.013,v[2]]);
      orientedQuad(p,idx,outer,[0,direction,0]);orientedQuad(p,idx,inside,[0,-direction,0]);
      for(let i=0;i<4;i++){
        const k=(i+1)%4;
        orientedQuad(p,idx,[outer[i],inside[i],inside[k],outer[k]],i===0?[0,0,-1]:i===1?[1,0,0]:i===2?[0,0,1]:[-1,0,0]);
      }
    }
    mesh(name,projectedUV(indexedGeometry(p,idx)),material);
  }
  for(const s of [-1,1]){
    const side=s<0?'left':'right',cx=s*.565;
    const front=nozzleShape(cx,-.055,4.17,.99,.63),end=nozzleShape(cx,-.065,5.04,.84,.39),inner=nozzleShape(cx,-.065,5.05,.75,.30),throat=nozzleShape(cx,-.065,4.48,.67,.27);
    ringSurface(front,end,`Exhaust • ${side} seal and side cheeks`,nozzleSeal,'outward');
    ringSurface(end,inner,`Exhaust • ${side} heat-tinted rim`,hotEdge,'rear');
    ringSurface(inner,throat,`Exhaust • ${side} recessed heat shield`,materials.nozzleInterior,'inward');
    polygon3(throat,`Exhaust • ${side} deep black throat`,materials.black,'rear');
    const rows=[[4.17,.264,-.373,.91],[4.48,.208,-.328,.87],[4.78,.163,-.286,.81],[5.04,.134,-.264,.76]];
    for(let i=0;i<8;i++)for(const direction of [-1,1]){
      const inset=.007;feather(`Exhaust • ${side} ${direction>0?'upper':'lower'} feather ${i+1}`,rows,cx,i/8+inset,(i+1)/8-inset,direction,featherMaterials[i]);
    }
    for(let i=0;i<5;i++){
      const z=4.59+i*.086,t=(z-4.48)/.57,w=mix(.67,.75,t),h=mix(.27,.30,t);
      for(const direction of [-1,1])box(`Exhaust • ${side} inner cooling rib ${i} ${direction}`,w-.026,.009,.016,cx,-.065+direction*(h*.5-.008),z,hotEdge);
    }
    for(const ss of [-1,1]){
      tube(`Exhaust • ${side} cheek seam ${ss}`,[[cx+ss*.489,-.06,4.20],[cx+ss*.45,-.063,4.62],[cx+ss*.414,-.065,5.00]],.0045,materials.exhaust,aircraft,false,4);
    }
    box(`Exhaust • ${side} inner divider`,.009,.23,.27,cx,-.065,4.70,materials.nozzleInterior);
  }
  const spine=plateFromOutline('Tail • center boat-tail', [[-.135,3.78],[.135,3.78],[.105,5.12],[0,5.28],[-.105,5.12]],.1,.18);
  spine.material=materials.trim;

  // A few purposeful small surface details are mesh-based for close-up depth.
  for(const s of [-1,1]){
    const pts=[];
    for(let i=0;i<=38;i++){const z=mix(-5.02,2.92,i/38),x=s*(bodyWidth(z)-.045);pts.push([x,bodyTop(x,z)+.008,z]);}
    tube(`Fuselage • ${s<0?'left':'right'} chine seam`,pts,.005,materials.trim,aircraft,false,4);
    // Shallow slit behind the wing-root shoulder.
    const x=s*.96,z=.43,y=bodyTop(x,z)+.009;
    const vent=box(`Dorsal vent • ${s<0?'left':'right'}`,.12,.012,.30,x,y,z,materials.dark);
    vent.rotation.z=s*-.28;
    for(let k=0;k<5;k++)box(`Dorsal vent grille • ${s} ${k}`,.13,.012,.009,x,y+.009,z-.12+k*.06,materials.trim);
  }

  for(const s of [-1,1]){
    const hinge=[];
    for(let i=0;i<=24;i++){
      const x=mix(1.74,4.19,i/24),lead=smoothProfile(wingRows,x,1),trail=smoothProfile(wingRows,x,2),z=mix(lead,trail,.86);
      hinge.push([s*x,wingHeight(x,z,true)+.0035,z]);
    }
    tube(`Wing • ${s<0?'left':'right'} control-surface hinge gap`,hinge,.0038,materials.trim,aircraft,false,4);
  }

  // Simplified closed bay outlines on the inferred underside, rather than
  // invented extended landing gear absent from the supplied photograph.
  for(const s of [-1,1]){
    const pts=[[s*.27,-2.10],[s*.63,-1.83],[s*.73,.18],[s*.28,.32],[s*.27,-2.10]].map(([x,z])=>[x,bodyBottom(x,z)-.009,z]);
    tube(`Belly • ${s<0?'left':'right'} closed bay seam`,pts,.005,materials.trim,aircraft,false,4);
  }
  const foreBay=[[-.12,-4.68],[.12,-4.68],[.14,-3.38],[-.14,-3.38],[-.12,-4.68]].map(([x,z])=>[x,bodyBottom(x,z)-.008,z]);
  tube('Belly • closed nose gear bay',foreBay,.008,materials.trim,aircraft,false,4);

  aircraft.traverse(object=>{
    if(object.isMesh){
      const position=object.geometry.attributes.position;
      if(!object.geometry.boundingSphere)object.geometry.computeBoundingSphere();
      if(position && !object.geometry.boundingBox)object.geometry.computeBoundingBox();
    }
  });
  if(options.scale !== undefined)aircraft.scale.setScalar(Number(options.scale)||1);
  return aircraft;
}

/**
 * A seated adult female aviator, modeled entirely with Three.js geometry.
 * The pelvis is the origin; +Y is up and the face looks along -Z.
 * Default dimensions: shoulder width ~0.39, head top ~0.70, boot sole ~-0.45.
 * Standard materials and ordinary UVs keep this suitable for glTF export.
 */
export function createPilot(THREE, options = {}) {
  const pilot = new THREE.Group();
  pilot.name = 'Pilot • female aviator';
  pilot.userData = {
    type: 'adult female pilot',
    pose: 'seated, right hand on stick and left hand on throttle',
    forward: [0, 0, -1],
    faceFocus: [0, .555, -.07],
    pelvisOrigin: [0, 0, 0],
  };
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const v3 = p => new THREE.Vector3(...p);
  const material = (color, roughness = .6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const mat = {
    skin: material(0xc89575, .64),
    skinShade: material(0xbb8568, .68),
    skinLight: material(0xd3a082, .62),
    lipsUpper: material(0xa66b60, .58),
    lipsLower: material(0xba8072, .54),
    lipLine: material(0x785149, .78),
    nostril: material(0x805b4d, .83),
    sclera: material(0xe7ded1, .4),
    irisRim: material(0x36342b, .43),
    iris: material(0x675c40, .45),
    irisInner: material(0x8b754b, .44),
    pupil: material(0x131917, .24),
    eyeLight: material(0xf9f5e9, .16),
    hair: material(0x2b211e, .59),
    hairStrand: material(0x3d2e25, .6),
    hairShine: material(0x49372b, .55),
    suit: material(0x586454, .9),
    suitLight: material(0x65705e, .87),
    suitShadow: material(0x434f43, .94),
    vest: material(0x414b42, .92),
    collar: material(0x727a65, .88),
    webbing: material(0xa6a48b, .93),
    webbingEdge: material(0xc1bda5, .95),
    stitch: material(0x858b72, .96),
    black: material(0x242c2b, .79),
    rubber: material(0x323b35, .85),
    glove: material(0x414b43, .84),
    gloveGrip: material(0x303933, .92),
    metal: material(0x8b9690, .39, { metalness: .67 }),
    buckle: material(0x58655e, .42, { metalness: .61 }),
    gold: material(0xb7a47b, .52, { metalness: .38 }),
  };
  const mesh = (name, geometry, m, parent = pilot) => {
    const o = new THREE.Mesh(geometry, m); o.name = `Pilot • ${name}`;
    o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const ellipsoid = (name, center, radii, m, parent = pilot, segments = [28, 18]) => {
    const o = mesh(name, new THREE.SphereGeometry(1, ...segments), m, parent);
    o.position.set(...center); o.scale.set(...radii); return o;
  };
  function geometry(positions, indices, uvs, colors) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals(); return g;
  }
  function curveTube(name, points, radius, m, parent = pilot, radial = 7, segments = null) {
    const curve = new THREE.CatmullRomCurve3(points.map(v3), false, 'centripetal');
    return mesh(name, new THREE.TubeGeometry(curve, segments ?? Math.max(12, points.length * 5), radius, radial, false), m, parent);
  }
  function capsuleBetween(name, a, b, radius, m, parent = pilot, radial = 10) {
    const p = v3(a), q = v3(b), delta = q.clone().sub(p), length = delta.length();
    const o = mesh(name, new THREE.CapsuleGeometry(radius, Math.max(.0001, length - radius * 2), 4, radial), m, parent);
    o.position.copy(p.add(q).multiplyScalar(.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return o;
  }
  function smoothProfile(rows, y, col) {
    let i = 0; while (i < rows.length - 2 && rows[i + 1][0] < y) i++;
    const a = rows[i], b = rows[i + 1], prev = rows[Math.max(0, i - 1)], next = rows[Math.min(rows.length - 1, i + 2)];
    const t = clamp((y - a[0]) / (b[0] - a[0]), 0, 1), h = b[0] - a[0];
    const ma = (b[col] - prev[col]) / (b[0] - prev[0]), mb = (next[col] - a[col]) / (next[0] - a[0]);
    return (2*t*t*t-3*t*t+1)*a[col] + (t*t*t-2*t*t+t)*h*ma + (-2*t*t*t+3*t*t)*b[col] + (t*t*t-t*t)*h*mb;
  }
  function loft(name, rows, m, parent = pilot, segY = 28, segRadial = 40) {
    const p = [], idx = [], uv = [];
    for (let j = 0; j <= segY; j++) {
      const y = mix(rows[0][0], rows.at(-1)[0], j / segY);
      const w = smoothProfile(rows, y, 1), d = smoothProfile(rows, y, 2), z0 = smoothProfile(rows, y, 3);
      for (let i = 0; i <= segRadial; i++) {
        const a = i / segRadial * Math.PI * 2;
        p.push(Math.sin(a)*w, y, z0 + Math.cos(a)*d); uv.push(i/segRadial, j/segY);
      }
    }
    for(let j=0;j<segY;j++) for(let i=0;i<segRadial;i++) { const a=j*(segRadial+1)+i,b=a+1,d=a+segRadial+1; idx.push(a,b,d,b,d+1,d); }
    const bottom=p.length/3; p.push(0,rows[0][0],rows[0][3]); uv.push(.5,0);
    const top=p.length/3; p.push(0,rows.at(-1)[0],rows.at(-1)[3]); uv.push(.5,1);
    for(let i=0;i<segRadial;i++){idx.push(bottom,i+1,i);const a=segY*(segRadial+1)+i;idx.push(top,a,a+1);}
    return mesh(name,geometry(p,idx,uv),m,parent);
  }
  function taperedSleeve(name, points, radii, m) {
    const curve=new THREE.CatmullRomCurve3(points.map(v3),false,'centripetal'), n=24, nr=12;
    const frames=curve.computeFrenetFrames(n,false),p=[],idx=[],uv=[];
    for(let j=0;j<=n;j++){
      const t=j/n,c=curve.getPointAt(t),u=t*(radii.length-1),k=Math.min(radii.length-2,Math.floor(u)),r=mix(radii[k],radii[k+1],u-k);
      for(let i=0;i<=nr;i++){
        const a=i/nr*Math.PI*2,offset=frames.normals[j].clone().multiplyScalar(Math.cos(a)*r).addScaledVector(frames.binormals[j],Math.sin(a)*r);
        const point=c.clone().add(offset);p.push(...point);uv.push(i/nr,t);
      }
    }
    for(let j=0;j<n;j++)for(let i=0;i<nr;i++){const a=j*(nr+1)+i,b=a+1,d=a+nr+1;idx.push(a,b,d,b,d+1,d);}
    const b=p.length/3;p.push(...curve.getPointAt(0));uv.push(.5,0);
    const e=p.length/3;p.push(...curve.getPointAt(1));uv.push(.5,1);
    for(let i=0;i<nr;i++){idx.push(b,i+1,i);const a=n*(nr+1)+i;idx.push(e,a,a+1);}
    return mesh(name,geometry(p,idx,uv),m);
  }
  function ribbon(name, points, width, m, parent=pilot) {
    const curve=new THREE.CatmullRomCurve3(points.map(v3),false,'centripetal'),p=[],idx=[],uv=[],n=28;
    for(let i=0;i<=n;i++){
      const t=i/n,c=curve.getPoint(t),tangent=curve.getTangent(t);
      const side=new THREE.Vector3(tangent.y,-tangent.x,0).normalize().multiplyScalar(width/2);
      for(const s of [-1,1]){const q=c.clone().addScaledVector(side,s);p.push(...q);uv.push((s+1)/2,t);}
    }
    for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
    const double=m.clone();double.side=THREE.DoubleSide;return mesh(name,geometry(p,idx,uv),double,parent);
  }

  // Reclined clothing follows a plausible seated skeleton, with curved sleeves
  // rather than cylinders meeting at exposed ball joints.
  const pelvis=ellipsoid('flight suit / pelvis',[0,.015,.025],[.137,.090,.088],mat.suit, pilot,[28,16]);
  loft('flight suit / torso',[
    [.025,.118,.072,.028],[.09,.119,.074,.022],[.17,.128,.077,.017],
    [.25,.154,.082,.020],[.31,.178,.069,.030],[.35,.145,.054,.032],[.378,.065,.038,.030]
  ],mat.suit);
  loft('survival vest',[[.077,.105,.018,-.066],[.15,.123,.021,-.066],[.23,.132,.018,-.062],[.30,.139,.014,-.045],[.328,.102,.010,-.034]],mat.vest,pilot,18,32);
  const neck=mesh('neck',new THREE.CylinderGeometry(.036,.043,.094,28,5),mat.skin);neck.position.set(0,.415,.020);neck.rotation.x=-.05;
  for(const s of [-1,1]){
    taperedSleeve(`${s<0?'left':'right'} bent trouser leg`,[[s*.074,.005,.020],[s*.089,-.054,-.18],[s*.095,-.105,-.377],[s*.092,-.245,-.434],[s*.09,-.367,-.46]],[.068,.063,.054,.045,.036],mat.suit);
    ellipsoid(`${s<0?'left':'right'} knee reinforcement`,[s*.094,-.092,-.393],[.052,.046,.017],mat.suitShadow,pilot,[20,12]);
    const boot=ellipsoid(`${s<0?'left':'right'} flight boot`,[s*.09,-.404,-.510],[.049,.043,.091],mat.black,pilot,[24,14]);boot.rotation.x=.07;
    const sole=ellipsoid(`${s<0?'left':'right'} boot sole`,[s*.09,-.440,-.512],[.050,.010,.094],mat.rubber,pilot,[24,10]);
    curveTube(`${s<0?'left':'right'} trouser outer seam`,[[s*.127,.0,-.015],[s*.148,-.053,-.20],[s*.147,-.10,-.369],[s*.134,-.246,-.435],[s*.126,-.357,-.461]],.0015,mat.stitch);
    for(let k=0;k<4;k++)curveTube(`${s<0?'left':'right'} boot lace ${k}`,[[s*.09-.022,-.385-k*.005,-.477-k*.018],[s*.09,-.371-k*.005,-.482-k*.018],[s*.09+.022,-.385-k*.005,-.477-k*.018]],.0019,mat.suitShadow,pilot,5,10);
  }
  const shoulderR=[.168,.310,.025],elbowR=[.227,.155,-.112],wristR=[.165,.169,-.298];
  const shoulderL=[-.168,.310,.025],elbowL=[-.235,.145,-.100],wristL=[-.223,.133,-.242];
  taperedSleeve('right sleeve',[shoulderR,[.205,.236,-.033],elbowR,[.207,.154,-.214],wristR],[.048,.045,.038,.032,.027],mat.suit);
  taperedSleeve('left sleeve',[shoulderL,[-.212,.235,-.034],elbowL,[-.236,.13,-.181],wristL],[.048,.045,.038,.032,.027],mat.suit);
  for(const [side,a,b]of[['right',[.168,.169,-.282],[.163,.169,-.310]],['left',[-.223,.133,-.227],[-.223,.130,-.256]]])capsuleBetween(`${side} sleeve cuff`,a,b,.028,mat.suitShadow);
  function hand(name,c,s){
    const palm=ellipsoid(`${name} gloved palm`,c,[.029,.019,.033],mat.glove,pilot,[22,12]);palm.rotation.x=-.1;
    const lengths=[.042,.047,.043,.033];
    for(let i=0;i<4;i++){
      const x=c[0]+(i-1.5)*.013,z=c[2]-.018,len=lengths[i];
      capsuleBetween(`${name} finger ${i+1} / proximal`,[x,c[1]+.003,z],[x,c[1]-.003,z-len*.57],.0062,mat.glove,pilot,8);
      capsuleBetween(`${name} finger ${i+1} / curled tip`,[x,c[1]-.003,z-len*.57],[x,c[1]-.023,z-len*.70],.0056,mat.gloveGrip,pilot,8);
    }
    capsuleBetween(`${name} thumb / base`,[c[0]-s*.024,c[1]-.003,c[2]+.008],[c[0]-s*.036,c[1]-.005,c[2]-.016],.008,mat.glove,pilot,9);
    capsuleBetween(`${name} thumb / tip`,[c[0]-s*.036,c[1]-.005,c[2]-.016],[c[0]-s*.023,c[1]-.017,c[2]-.030],.0064,mat.gloveGrip,pilot,9);
    curveTube(`${name} glove stitching`,[[c[0]-.018,c[1]+.017,c[2]+.015],[c[0]-.019,c[1]+.019,c[2]-.010],[c[0],c[1]+.020,c[2]-.018],[c[0]+.019,c[1]+.019,c[2]-.010],[c[0]+.018,c[1]+.017,c[2]+.015]],.0008,mat.stitch,pilot,4,16);
  }
  hand('right hand',[.160,.162,-.327],1);hand('left hand',[-.223,.124,-.274],-1);

  // Padded collar, fabric pockets, stitched webbing and quick-release harness.
  for(const s of [-1,1]){
    ribbon(`${s<0?'left':'right'} folded collar`,[[s*.025,.389,-.014],[s*.051,.375,-.036],[s*.083,.342,-.051],[s*.058,.318,-.066]],.033,mat.collar);
    ellipsoid(`${s<0?'left':'right'} vest pocket`,[s*.071,.188,-.082],[.045,.061,.016],mat.vest,pilot,[18,12]);
    curveTube(`${s<0?'left':'right'} pocket seam`,[[s*.036,.235,-.094],[s*.105,.235,-.091],[s*.112,.145,-.087],[s*.039,.136,-.098]],.0012,mat.stitch,pilot,5);
    const shoulderStrap=[[s*.101,.337,-.025],[s*.110,.292,-.072],[s*.086,.218,-.102],[s*.066,.134,-.110],[s*.036,.079,-.102]];
    ribbon(`${s<0?'left':'right'} shoulder harness`,shoulderStrap,.026,mat.webbing);
    for(const edge of [-1,1])curveTube(`${s<0?'left':'right'} harness stitching ${edge}`,shoulderStrap.map(([x,y,z])=>[x+edge*.010,y,z-.0012]),.0007,mat.webbingEdge,pilot,4,26);
    ribbon(`${s<0?'left':'right'} lap harness`,[[s*.121,.037,-.031],[s*.097,.057,-.084],[s*.049,.074,-.102],[s*.016,.077,-.105]],.031,mat.webbing);
    const adjuster=mesh(`${s<0?'left':'right'} harness adjuster`,new THREE.BoxGeometry(.034,.024,.007),mat.buckle);adjuster.position.set(s*.092,.251,-.095);adjuster.rotation.z=s*-.12;
    const keeper=mesh(`${s<0?'left':'right'} harness keeper`,new THREE.BoxGeometry(.022,.009,.008),mat.webbing);keeper.position.set(s*.092,.251,-.100);keeper.rotation.z=s*-.12;
  }
  ribbon('chest harness cross strap',[[-.088,.198,-.109],[0,.194,-.113],[.088,.198,-.109]],.016,mat.webbing);
  const buckle=mesh('central quick-release buckle',new THREE.CylinderGeometry(.026,.026,.009,24),mat.buckle);buckle.rotation.x=Math.PI/2;buckle.position.set(0,.081,-.112);
  const buckleFace=mesh('buckle inset',new THREE.CylinderGeometry(.018,.018,.003,20),mat.metal);buckleFace.rotation.x=Math.PI/2;buckleFace.position.set(0,.081,-.118);
  const buckleSlot=mesh('buckle release slot',new THREE.BoxGeometry(.021,.003,.003),mat.black);buckleSlot.position.set(0,.081,-.121);
  curveTube('flight suit zipper',[[0,.111,-.094],[0,.23,-.087],[0,.324,-.054]],.0022,mat.black,pilot,6);
  const pull=mesh('zipper pull',new THREE.BoxGeometry(.008,.016,.004),mat.metal);pull.position.set(0,.296,-.073);pull.rotation.z=.18;

  // A small original fabric label, drawn locally; no photographed face or
  // external image is used anywhere in the character.
  let patchMat=mat.gold;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');
    if(c){c.fillStyle='#3b463b';c.fillRect(0,0,256,128);c.strokeStyle='#b5b198';c.lineWidth=5;c.strokeRect(8,8,240,112);c.fillStyle='#d3ceb2';c.font='600 32px sans-serif';c.textAlign='center';c.fillText('AVIATOR',128,86);c.beginPath();c.moveTo(54,37);c.lineTo(102,37);c.lineTo(128,24);c.lineTo(154,37);c.lineTo(202,37);c.lineTo(174,48);c.lineTo(143,48);c.lineTo(128,55);c.lineTo(113,48);c.lineTo(82,48);c.closePath();c.fill();const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;patchMat=material(0xffffff,.94,{map:tex});}
  }
  const patch=mesh('embroidered aviator label',new THREE.PlaneGeometry(.078,.039),patchMat);patch.rotation.y=Math.PI;patch.position.set(-.075,.275,-.091);

  // A sculpted head. Cross sections define the jaw, cheeks and cranium; smooth
  // relief is added to the front surface for eye sockets, nose and chin.
  const head=new THREE.Group();head.name='Pilot • head and headset';head.position.set(0,.555,.005);head.rotation.y=options.headYaw??-.14;pilot.add(head);
  const headRows=[[-.119,.018,.027,.005],[-.112,.031,.039,.004],[-.096,.052,.054,.003],[-.072,.067,.064,.001],[-.043,.079,.072,0],[-.008,.084,.077,0],[.030,.082,.079,.002],[.065,.073,.073,.004],[.092,.058,.059,.005],[.112,.036,.039,.006],[.124,.002,.003,.006]];
  const gauss=(x,y,cx,cy,sx,sy)=>Math.exp(-Math.pow((x-cx)/sx,2)-Math.pow((y-cy)/sy,2));
  function facialRelief(x,y){
    let dz=0;
    for(const s of [-1,1]){
      dz+=.0062*gauss(x,y,s*.033,.005,.021,.015); // eye sockets
      dz-=.0040*gauss(x,y,s*.035,.029,.026,.011); // brow plane
      dz-=.0057*gauss(x,y,s*.046,-.025,.027,.023); // cheeks
      dz-=.0040*gauss(x,y,s*.011,-.036,.010,.008); // nose wings
    }
    dz-=.0085*gauss(x,y,0,.006,.013,.036); // nasal bridge
    dz-=.0225*gauss(x,y,0,-.023,.015,.023); // nose tip
    dz-=.0028*gauss(x,y,0,-.058,.028,.014); // mouth mound
    dz-=.0037*gauss(x,y,0,-.095,.027,.016); // chin
    return dz;
  }
  function frontZ(x,y){
    const w=smoothProfile(headRows,y,1),d=smoothProfile(headRows,y,2),z0=smoothProfile(headRows,y,3);
    const c=Math.sqrt(Math.max(0,1-Math.pow(x/Math.max(.002,w),2)));
    return z0-d*c+facialRelief(x,y)*Math.pow(c,5);
  }
  {
    const p=[],idx=[],uv=[],colors=[],ny=54,nr=72,skinBase=new THREE.Color(0xc89575),rose=new THREE.Color(0xc58a78),lighter=new THREE.Color(0xd4a286);
    for(let j=0;j<=ny;j++){
      const y=mix(headRows[0][0],headRows.at(-1)[0],j/ny),w=smoothProfile(headRows,y,1),d=smoothProfile(headRows,y,2),z0=smoothProfile(headRows,y,3);
      for(let i=0;i<=nr;i++){
        const a=i/nr*Math.PI*2,x=Math.sin(a)*w,c=Math.cos(a),front=Math.pow(Math.max(0,-c),5),z=z0+d*c+facialRelief(x,y)*front;
        p.push(x,y,z);uv.push(i/nr,j/ny);
        const blush=(gauss(x,y,.047,-.028,.032,.025)+gauss(x,y,-.047,-.028,.032,.025))*.13*front;
        const col=skinBase.clone().lerp(rose,blush).lerp(lighter,.035*Math.max(0,c));colors.push(col.r,col.g,col.b);
      }
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nr;i++){const a=j*(nr+1)+i,b=a+1,d=a+nr+1;idx.push(a,b,d,b,d+1,d);}
    const b=p.length/3;p.push(0,headRows[0][0],headRows[0][3]);uv.push(.5,0);colors.push(skinBase.r,skinBase.g,skinBase.b);
    const t=p.length/3;p.push(0,headRows.at(-1)[0],headRows.at(-1)[3]);uv.push(.5,1);colors.push(skinBase.r,skinBase.g,skinBase.b);
    for(let i=0;i<nr;i++){idx.push(b,i+1,i);const a=ny*(nr+1)+i;idx.push(t,a,a+1);}
    mesh('sculpted face and cranium',geometry(p,idx,uv,colors),material(0xffffff,.65,{vertexColors:true}),head);
  }
  // The almond eye surfaces meet the eyelid edge, with curved sclera and
  // restrained irises. Their proportions are deliberately human-sized.
  for(const s of [-1,1]){
    const side=s<0?'left':'right',cx=s*.033,cy=.004,halfW=.0186;
    const eyeXY=(u,v)=>{const arch=Math.sqrt(Math.max(0,1-u*u));return[cx+u*halfW,cy+s*u*.0018+arch*(v>=0?v*.0066:v*.0046)];};
    function eyeZ(x,y,u,v){return frontZ(x,y)-.0007-.0043*Math.sqrt(Math.max(0,1-u*u))*Math.sqrt(Math.max(0,1-v*v));}
    const p=[],idx=[],uv=[],nx=20,ny=8;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){const u=i/nx*2-1,v=j/ny*2-1,[x,y]=eyeXY(u,v);p.push(x,y,eyeZ(x,y,u,v));uv.push(i/nx,j/ny);}
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,d=a+nx+1;idx.push(a,d,b,b,d,d+1);}
    mesh(`${side} eye / curved sclera`,geometry(p,idx,uv),mat.sclera,head);
    // Iris disks are clipped to the almond opening and follow the scleral
    // curvature. Full spheres here would show above/below the eyelids.
    function irisDisk(label,radius,depth,m){
      const p=[],idx=[],uv=[],rings=3,segments=32;
      for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
        const a=i/segments*Math.PI*2,r=radius*j/rings,x=cx+Math.cos(a)*r,u=(x-cx)/halfW;
        const [,upper]=eyeXY(u,1),[,lower]=eyeXY(u,-1),middle=cy+s*u*.0018;
        const y=clamp(cy+Math.sin(a)*r,lower+.00025,upper-.00025);
        const v=(y-middle)/(y>=middle?upper-middle:middle-lower);
        p.push(x,y,eyeZ(x,y,u,v)-depth);uv.push(.5+Math.cos(a)*j/rings*.5,.5+Math.sin(a)*j/rings*.5);
      }
      for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,d=a+segments+1;idx.push(a,b,d,b,d+1,d);}
      mesh(`${side} eye / ${label}`,geometry(p,idx,uv),m,head);
    }
    irisDisk('dark limbal ring',.0074,.0006,mat.irisRim);
    irisDisk('hazel iris',.0065,.0010,mat.iris);
    irisDisk('amber inner iris',.0041,.00135,mat.irisInner);
    irisDisk('pupil',.0029,.0017,mat.pupil);
    const highlightX=cx-.0021,highlightY=cy+.0024,highlightU=(highlightX-cx)/halfW,highlightV=(highlightY-cy-s*highlightU*.0018)/(.0066*Math.sqrt(1-highlightU*highlightU));
    ellipsoid(`${side} eye / catchlight`,[highlightX,highlightY,eyeZ(highlightX,highlightY,highlightU,highlightV)-.0021],[.00095,.00095,.0003],mat.eyeLight,head,[10,6]);
    for(const upper of [true,false]){
      const pts=[];for(let i=0;i<=16;i++){const u=i/16*2-1,[x,y]=eyeXY(u,upper?1:-1);pts.push([x,y,frontZ(x,y)-.0010]);}
      curveTube(`${side} ${upper?'upper':'lower'} eyelid`,pts,upper?.0018:.00115,upper?mat.skinShade:mat.skin,head,6,24);
      if(upper)curveTube(`${side} upper lashes`,pts.map(([x,y,z])=>[x,y-.0005,z-.0008]),.00055,mat.hair,head,5,24);
    }
    const brow=[];
    for(let i=0;i<=14;i++){const t=i/14,x=s*(.014+t*.046),y=.027+Math.sin(t*Math.PI)*.0062-t*.0018;brow.push([x,y,frontZ(x,y)-.0017]);}
    ribbon(`${side} shaped eyebrow`,brow,.0033,mat.hair,head);
    ellipsoid(`${side} subtle nostril`,[s*.0105,-.037,frontZ(s*.0105,-.037)-.0007],[.0027,.0012,.0013],mat.nostril,head,[14,8]);
    ellipsoid(`${side} ear`,[s*.085,-.018,.006],[.013,.025,.014],mat.skinShade,head,[20,12]);
  }
  function lip(upper){
    const p=[],idx=[],uv=[],nx=28,ny=6;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=i/nx*2-1,v=j/ny,arch=Math.sqrt(Math.max(0,1-u*u)),x=u*.0235;
      const middle=-.064+.0033*u*u;
      const upperH=(.0036+.0017*Math.exp(-Math.pow((Math.abs(u)-.30)/.20,2)))*arch;
      const y=middle+(upper?1:-1)*v*(upper?upperH:.0048*arch);
      const z=frontZ(x,y)-.0013-.0027*arch*Math.sin(v*Math.PI*.86);
      p.push(x,y,z);uv.push(i/nx,j/ny);
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,d=a+nx+1;if(upper)idx.push(a,d,b,b,d,d+1);else idx.push(a,b,d,b,d+1,d);}
    mesh(upper?'upper lip / cupid bow':'lower lip',geometry(p,idx,uv),upper?mat.lipsUpper:mat.lipsLower,head);
  }
  lip(true);lip(false);
  const mouth=[];for(let i=0;i<=18;i++){const u=i/18*2-1,x=u*.0235,y=-.064+.0033*u*u;mouth.push([x,y,frontZ(x,y)-.0017]);}
  curveTube('relaxed smile / mouth seam',mouth,.00048,mat.lipLine,head,5,26);

  // Swept dark hair leaves the entire face visible; a low bun stays clear of
  // the canopy. The scalp has its own closed profile rather than a sphere cap.
  const hairBoundary=a=>-.073+.141*Math.pow((1-Math.cos(a))/2,2)+.004*Math.sin(a)*Math.pow(Math.max(0,-Math.cos(a)),2);
  function scalpPoint(a,t,outset=.003){
    const y=mix(.123,hairBoundary(a),t),w=smoothProfile(headRows,y,1),d=smoothProfile(headRows,y,2),z0=smoothProfile(headRows,y,3);
    return[Math.sin(a)*(w+outset),y+.002,z0+Math.cos(a)*(d+outset)];
  }
  {
    const p=[],idx=[],uv=[],nr=64,ny=24;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nr;i++){p.push(...scalpPoint(i/nr*Math.PI*2,j/ny));uv.push(i/nr,j/ny);}
    for(let j=0;j<ny;j++)for(let i=0;i<nr;i++){const a=j*(nr+1)+i,b=a+1,d=a+nr+1;idx.push(a,d,b,b,d,d+1);}
    // Close the tiny crown ring. Without this cap, the pale scalp can show
    // through the opening behind the headset when viewed from above.
    const crown=p.length/3;
    p.push(0,.125,smoothProfile(headRows,.123,3));uv.push(.5,0);
    for(let i=0;i<nr;i++)idx.push(crown,i,i+1);
    mesh('swept-back hair',geometry(p,idx,uv),mat.hair,head);
  }
  ellipsoid('tied low bun',[0,-.041,.105],[.044,.040,.042],mat.hair,head,[28,18]);
  const tie=mesh('hair tie',new THREE.TorusGeometry(.029,.0032,6,24),mat.black,head);tie.position.set(0,-.043,.104);tie.rotation.x=Math.PI/2;
  for(let k=0;k<13;k++){
    const a0=.27+k/(12)*Math.PI*1.83,pts=[];
    for(let j=0;j<=10;j++){
      const t=j/10,a=a0+.13*Math.sin(t*Math.PI);pts.push(scalpPoint(a,.97-t*.83,.0040));
    }
    curveTube(`hair sweep ${k+1}`,pts,.0007,k%3===0?mat.hairShine:mat.hairStrand,head,5,24);
  }
  for(let s of [-1,1])curveTube(`${s<0?'left':'right'} temple hair`,[[s*.061,.065,-.045],[s*.077,.025,-.029],[s*.082,-.013,-.006]],.0044,mat.hair,head,7,18);

  // Compact aviation headset. The microphone stays beside the mouth so the
  // nose, lips and eyes remain readable through the canopy.
  for(const s of [-1,1]){
    const side=s<0?'left':'right';
    ellipsoid(`${side} headset ear seal`,[s*.095,-.011,.008],[.014,.032,.027],mat.black,head,[22,14]);
    ellipsoid(`${side} headset housing`,[s*.106,-.010,.008],[.010,.029,.025],mat.suitShadow,head,[22,14]);
    ellipsoid(`${side} headset metal pivot`,[s*.115,.004,.008],[.0025,.006,.006],mat.metal,head,[14,8]);
    curveTube(`${side} headset support`,[[s*.105,-.007,.026],[s*.109,.028,.023],[s*.091,.071,.018]],.0030,mat.metal,head,6,16);
  }
  const headband=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI;headband.push([Math.cos(a)*.100,.014+Math.sin(a)*.131,.013]);}
  curveTube('headset padded headband',headband,.0068,mat.black,head,8,36);
  curveTube('headset band inset',headband.map(([x,y,z])=>[x,y+.003,z+.001]),.0033,mat.suitShadow,head,6,36);
  curveTube('headset microphone boom',[[-.112,-.012,.009],[-.105,-.037,-.039],[-.083,-.055,-.082],[-.039,-.059,-.103]],.0023,mat.metal,head,7,22);
  const mic=ellipsoid('microphone capsule',[-.034,-.059,-.103],[.010,.0045,.0045],mat.black,head,[18,10]);mic.rotation.z=.12;
  curveTube('headset cable',[[-.104,.515,.022],[-.116,.452,.040],[-.124,.370,.035],[-.151,.319,.039]],.0022,mat.black,pilot,6,22);

  if(options.scale!==undefined)pilot.scale.setScalar(Number(options.scale)||1);
  pilot.traverse(o=>{if(o.isMesh){
    const n=o.geometry.attributes.normal,p=o.geometry.attributes.position;
    // Three.js's lathed capsule poles and pinched eyelid/lip endpoints can
    // contain an otherwise harmless zero normal. Give these their geometric
    // exterior direction so every exported normal is well-defined.
    for(let i=0;i<n.count;i++){
      const normal=new THREE.Vector3().fromBufferAttribute(n,i);
      if(normal.lengthSq()<1e-12){
        if(o.geometry.type==='CapsuleGeometry')normal.set(0,p.getY(i)<0?-1:1,0);
        else normal.set(0,0,-1);
      }else normal.normalize();
      n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  }});
  return pilot;
}



export default createAircraft;
