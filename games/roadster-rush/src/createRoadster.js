import * as THREE from './vendor/three.module.js';

/**
 * A fully procedural Roadster CONCEPT with smooth, sculpted bodywork.
 * Metres, Y-up, +Z forward. No DOM, textures, fonts, loaders, or external assets.
 * @returns {THREE.Group} See README for the animation/disposal API.
 */
export function createRoadster(options = {}) {
  const car = new THREE.Group();
  car.name = 'Roadster';
  const parts = {};
  for (const name of ['body', 'glasshouse', 'frontFascia', 'rearFascia', 'trim', 'wheels', 'thrusters', 'lighting']) {
    const group = new THREE.Group(); group.name = name; car.add(group); parts[name] = group;
  }
  const paint = new THREE.MeshPhysicalMaterial({color: options.color ?? 0xf5f5f1,
    metalness: .16, roughness: .25, clearcoat: 1, clearcoatRoughness: .19, envMapIntensity: .95});
  const doublePaint=paint.clone();doublePaint.side=THREE.DoubleSide;
  const glass = new THREE.MeshPhysicalMaterial({color: 0x111315, metalness: .22,
    roughness: .16, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: .85, side: THREE.DoubleSide});
  const dark = new THREE.MeshStandardMaterial({color: 0x080a0e, metalness: .45, roughness: .3});
  const carbon = new THREE.MeshStandardMaterial({color: 0x14171c, metalness: .3, roughness: .38});
  const rubber = new THREE.MeshStandardMaterial({color: 0x101216, metalness: 0, roughness: .83});
  const alloy = new THREE.MeshStandardMaterial({color: 0x8d939a, metalness: .97, roughness: .23});
  const polished = new THREE.MeshStandardMaterial({color: 0xcbd0d5, metalness: 1, roughness: .16});
  const rotor = new THREE.MeshStandardMaterial({color: 0x45494e, metalness: .92, roughness: .36});
  const brake = new THREE.MeshStandardMaterial({color: 0x9e1522, metalness: .38, roughness: .3});
  const headLED = new THREE.MeshStandardMaterial({color: 0xffffff, emissive: 0xe9f3ff, emissiveIntensity: 5, toneMapped: false});
  const tailLED = new THREE.MeshStandardMaterial({color: 0xff2440, emissive: 0xff1028, emissiveIntensity: 4, toneMapped: false});
  const amberLED = new THREE.MeshStandardMaterial({color: 0xffa31a, emissive: 0xff6e00, emissiveIntensity: 3, toneMapped: false});
  const whiteInk = new THREE.MeshStandardMaterial({color: 0xe1e4e8, metalness: .5, roughness: .4});

  function mesh(geometry, material, group, name) {
    const m = new THREE.Mesh(geometry, material); m.name = name;
    m.castShadow = material !== headLED && material !== tailLED && material !== amberLED;
    m.receiveShadow = true; group.add(m); return m;
  }
  function box(group, name, xyz, size, material, rotation) {
    if(Math.min(...size)>.025&&Math.max(...size)>.07)return roundedBox(group,name,xyz,size,material,Math.min(.012,Math.min(...size)*.2),rotation);
    const m = mesh(new THREE.BoxGeometry(...size), material, group, name);
    m.position.set(...xyz); if (rotation) m.rotation.set(...rotation); return m;
  }
  function roundedBox(group,name,xyz,size,material,radius=.012,rotation) {
    // Rounded-box projection with analytic normals; no texture or addon needed.
    const segments=11,r=Math.min(radius,...size.map(v=>v/2));
    const geometry=new THREE.BoxGeometry(1,1,1,segments,segments,segments);
    const p=geometry.attributes.position,n=geometry.attributes.normal;
    const point=new THREE.Vector3(),normal=new THREE.Vector3();
    const inner=new THREE.Vector3(...size).multiplyScalar(.5).subScalar(r);
    for(let i=0;i<p.count;i++) {
      point.fromBufferAttribute(p,i);normal.copy(point);
      for(const axis of ['x','y','z'])normal[axis]-=Math.sign(normal[axis])*.5/segments;
      normal.normalize();
      p.setXYZ(i,Math.sign(point.x)*inner.x+normal.x*r,Math.sign(point.y)*inner.y+normal.y*r,Math.sign(point.z)*inner.z+normal.z*r);
      n.setXYZ(i,normal.x,normal.y,normal.z);
    }
    const m=mesh(geometry,material,group,name);m.position.set(...xyz);if(rotation)m.rotation.set(...rotation);return m;
  }
  function surface(group, name, vertices, faces, material) {
    const pos = [], idx = [];
    for (const v of vertices) pos.push(...v);
    for (const f of faces) for (let i = 1; i < f.length - 1; i++) idx.push(f[0], f[i], f[i+1]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    geo.setIndex(idx); geo.computeVertexNormals(); return mesh(geo, material, group, name);
  }
  function polygon(group, name, pts, material) {
    // Each vertex is a 3D point; callers provide a convex planar outline.
    return surface(group, name, pts, [pts.map((_, i) => i)], material);
  }
  function roundedPlate(group,name,outline,y,thickness,radius,material){
    const shape=new THREE.Shape();
    for(let i=0;i<outline.length;i++){
      const p=new THREE.Vector2(...outline[i]),prev=new THREE.Vector2(...outline[(i+outline.length-1)%outline.length]),next=new THREE.Vector2(...outline[(i+1)%outline.length]);
      const r=Math.min(radius,p.distanceTo(prev)*.35,p.distanceTo(next)*.35);
      const incoming=prev.sub(p).normalize().multiplyScalar(r).add(p),outgoing=next.sub(p).normalize().multiplyScalar(r).add(p);
      if(i===0)shape.moveTo(incoming.x,incoming.y);else shape.lineTo(incoming.x,incoming.y);
      shape.quadraticCurveTo(p.x,p.y,outgoing.x,outgoing.y);
    }
    shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness-.006,steps:1,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:3,curveSegments:8});
    geometry.rotateX(Math.PI/2);geometry.translate(0,y-.003,0);
    return mesh(geometry,material,group,name);
  }
  function line(group, name, pts, radius, material, closed = false) {
    const path = new THREE.CurvePath();
    const p = pts.map(v => new THREE.Vector3(...v)); if (closed) p.push(p[0]);
    for (let i=1; i<p.length; i++) path.add(new THREE.LineCurve3(p[i-1], p[i]));
    return mesh(new THREE.TubeGeometry(path, Math.max(2, (p.length-1)*2), radius, 8, false), material, group, name);
  }
  function smoothSpline(points) {
    // Natural cubic spline: position, tangent, and curvature stay continuous.
    const n=points.length,second=new Float64Array(n),work=new Float64Array(n);
    for(let i=1;i<n-1;i++){
      const left=points[i][0]-points[i-1][0],right=points[i+1][0]-points[i][0];
      const sigma=left/(left+right),denominator=sigma*second[i-1]+2;
      second[i]=(sigma-1)/denominator;
      const slopes=(points[i+1][1]-points[i][1])/right-(points[i][1]-points[i-1][1])/left;
      work[i]=(6*slopes/(left+right)-sigma*work[i-1])/denominator;
    }
    for(let i=n-2;i>=0;i--)second[i]=second[i]*second[i+1]+work[i];
    return value=>{
      const x=THREE.MathUtils.clamp(value,points[0][0],points[n-1][0]);let i=1;
      while(i<n-1&&x>points[i][0])i++;
      const h=points[i][0]-points[i-1][0],a=(points[i][0]-x)/h,b=1-a;
      return a*points[i-1][1]+b*points[i][1]+((a*a*a-a)*second[i-1]+(b*b*b-b)*second[i])*h*h/6;
    };
  }
  function smooth01(value){const t=THREE.MathUtils.clamp(value,0,1);return t*t*t*(10+t*(-15+6*t));}
  function bezier5(points,t){
    const weights=[1,5,10,10,5,1];const result=[0,0];
    for(let i=0;i<6;i++){const weight=weights[i]*Math.pow(t,i)*Math.pow(1-t,5-i);result[0]+=points[i][0]*weight;result[1]+=points[i][1]*weight;}
    return result;
  }
  function cylX(group, name, p, radius, depth, material, segments=48) {
    const m = mesh(new THREE.CylinderGeometry(radius,radius,depth,segments), material, group, name);
    m.rotation.z = Math.PI/2; m.position.set(...p); return m;
  }
  function torusX(group, name, x, radius, tube, material, segments=64) {
    const m = mesh(new THREE.TorusGeometry(radius,tube,6,segments), material, group,name);
    m.rotation.y = Math.PI/2; m.position.x=x; return m;
  }
  // Curvature-continuous guide curves keep long reflections free of hard bands.
  // Columns: Z, half-width, shoulder height, hood/deck centre height.
  const profile = [
    [-2.23,1.025,.765,.777], [-1.84,1.074,.827,.786], [-1.38,1.082,.845,.802],
    [-.92,1.032,.798,.786], [-.28,.997,.777,.780], [.62,1.015,.808,.796],
    [1.34,1.055,.820,.730], [1.75,1.027,.752,.690], [2.08,.987,.690,.656], [2.27,.942,.638,.638]
  ];
  const guide=[1,2,3].map(column=>smoothSpline(profile.map(point=>[point[0],point[column]])));
  const at=z=>guide.map(curve=>curve(z));
  const wheelY=.371, archR=.414, wheelZ=[1.38,-1.39];
  const stations = new Set(profile.map(p=>p[0]));
  for(let i=0;i<=120;i++)stations.add(THREE.MathUtils.lerp(-2.23,2.27,i/120));
  for(const zc of wheelZ) {
    stations.add(zc-archR-.001); stations.add(zc+archR+.001);
    for(let i=0;i<=48;i++) stations.add(zc+archR*Math.cos(i/48*Math.PI));
  }
  const zs=[...stations].sort((a,b)=>a-b).filter((z,i,array)=>!i||z-array[i-1]>1e-7);
  function archBottom(z) {
    for(const zc of wheelZ) {
      const dz=z-zc;
      if(Math.abs(dz)<=archR+1e-7) return wheelY+Math.sqrt(Math.max(0,archR*archR-dz*dz));
    }
    return .205;
  }
  const xAtY = (s,z,y) => {const [w,top]=at(z),t=THREE.MathUtils.clamp((y-.205)/(top-.205),0,1);return s*(w-.052*(1-t)+.008*Math.sin(Math.PI*t));};
  const sideMeshes=[];
  for(const s of [-1,1]) {
    const v=[],f=[],rows=8;
    for(const z of zs) {
      const [w,top]=at(z), bottom=archBottom(z);
      for(let j=0;j<=rows;j++){
        const y=THREE.MathUtils.lerp(top,bottom,j/rows);v.push([xAtY(s,z,y),y,z]);
      }
    }
    for(let i=0;i<zs.length-1;i++) {
      for(let j=0;j<rows;j++){
        const k=i*(rows+1)+j;f.push(s===1?[k,k+rows+1,k+rows+2,k+1]:[k+1,k+rows+2,k+rows+1,k]);
      }
    }
    sideMeshes.push(surface(parts.body,`sculpted-side-${s}`,v,f,paint));
    // Recessed black wheel wells and extremely narrow arch-edge reveals.
    for(const [wi,zc] of wheelZ.entries()) {
      const vertices=[],faces=[],edge=[];
      for(let i=0;i<=40;i++) {
        const a=i/40*Math.PI,z=zc+archR*Math.cos(a),y=wheelY+archR*Math.sin(a),x=xAtY(s,z,y);
        vertices.push([x-s*.005,y,z],[x-s*.20,y+.003,z]); edge.push([x+s*.001,y,z]);
        if(i<40) {const k=i*2; faces.push(s===1?[k,k+1,k+3,k+2]:[k+2,k+3,k+1,k]);}
      }
      surface(parts.trim,`wheel-well-${s}-${wi}`,vertices,faces,dark);
      line(parts.trim,`arch-reveal-${s}-${wi}`,edge,.005,dark);
    }
    // A sharp, swept sill which ends before either tire.
    const sill = box(parts.trim,`side-skirt-${s}`,[s*.977,.203,-.005],[.095,.063,1.88],carbon);
    sill.rotation.z=-s*.07;
    line(parts.trim,`sill-blade-${s}`,[[s*1.026,.215,-.94],[s*1.013,.216,.89]],.009,dark);
    const seam = [[.62,.802],[.61,.59],[.44,.247],[-.91,.247],[-1.095,.65],[-1.085,.812]];
    const doorGap=[];
    for(let j=0;j<seam.length-1;j++)for(let i=0;i<12;i++){
      const t=i/12,z=THREE.MathUtils.lerp(seam[j][0],seam[j+1][0],t),y=THREE.MathUtils.lerp(seam[j][1],seam[j+1][1],t);
      doorGap.push([xAtY(s,z,y)+s*.0015,y,z]);
    }
    line(parts.trim,`door-gap-${s}`,doorGap,.0021,dark);
    box(parts.trim,`flush-door-handle-${s}`,[s*1.028,.731,-.73],[.007,.019,.128],dark,[0,0,-s*.035]);
    box(parts.lighting,`amber-marker-${s}`,[s*1.042,.685,1.91],[.009,.013,.081],amberLED);
    box(parts.trim,`marker-housing-${s}`,[s*1.036,.684,1.90],[.012,.028,.15],dark);
  }
  // Shared indexed vertices and a rounded shoulder roll carry uninterrupted
  // specular highlights across the entire bonnet, fenders, and rear deck.
  const topZ=zs;
  const tv=[],tf=[];
  function topY(z, fraction) {
    const [,shoulder,hood]=at(z),a=THREE.MathUtils.clamp(Math.abs(fraction),0,1);
    if(a>.84){const q=(a-.84)/.16;return shoulder+.020*Math.sqrt(Math.max(0,1-q*q));}
    const t=a/.84;return THREE.MathUtils.lerp(hood,shoulder+.020,t*t*(3-2*t));
  }
  const halfFractions=Array.from({length:25},(_,i)=>.84*i/24);
  for(let i=1;i<=8;i++)halfFractions.push(.84+.16*Math.sin(i/8*Math.PI/2));
  const fractions=[...halfFractions.slice(1).reverse().map(v=>-v),...halfFractions],columns=fractions.length;
  for(const z of topZ) for(const r of fractions) tv.push([at(z)[0]*r,topY(z,r),z]);
  for(let j=0;j<topZ.length-1;j++) for(let i=0;i<columns-1;i++) {
    const k=j*columns+i; tf.push([k,k+columns,k+columns+1,k+1]);
  }
  const top=surface(parts.body,'smooth-hood-and-deck',tv,tf,paint);
  // Weld shading along the shoulder seam without merging the animation groups.
  for(let j=0;j<zs.length;j++)for(let si=0;si<2;si++){
    const tp=j*columns+(si?columns-1:0),sp=j*9;
    const tn=top.geometry.attributes.normal,sn=sideMeshes[si].geometry.attributes.normal;
    const normal=new THREE.Vector3().fromBufferAttribute(tn,tp).add(new THREE.Vector3().fromBufferAttribute(sn,sp)).normalize();
    tn.setXYZ(tp,normal.x,normal.y,normal.z);sn.setXYZ(sp,normal.x,normal.y,normal.z);
  }
  for(const s of [-1,1]) {
    const hoodGap=[];
    for(let i=0;i<=48;i++) {
      const z=THREE.MathUtils.lerp(.70,2.15,i/48);
      const r=THREE.MathUtils.lerp(.66,.60,(z-.70)/1.45);
      hoodGap.push([s*at(z)[0]*r,topY(z,r)+.001,z]);
    }
    line(parts.trim,`hood-gap-${s}`,hoodGap,.0019,dark);
  }
  line(parts.trim,'hood-cowl-gap',[[-.68,.807,.70],[0,.795,.70],[.68,.807,.70]],.0022,dark);

  // ONE swept glass shell, including windshield, roof, rear glass and sides.
  // Its longitudinal splines are C2; fifth-degree shoulder blends match both
  // tangents and curvature to the roof and the body at the beltline.
  const canopyMin=-1.44,canopyMax=.72,canopyJoin=.72;
  const roofHeight=smoothSpline([[-1.44,.818],[-1.19,.925],[-.93,1.083],[-.64,1.172],[-.36,1.190],[-.08,1.174],[.18,1.105],[.44,.942],[.72,.812]]);
  const roofWidth=smoothSpline([[-1.44,.696],[-1.19,.670],[-.93,.628],[-.64,.611],[-.36,.615],[-.08,.626],[.18,.653],[.44,.711],[.72,.753]]);
  const beltWidth=smoothSpline([[-1.44,.765],[-1.19,.901],[-.93,.921],[-.64,.916],[-.36,.902],[-.08,.894],[.18,.886],[.44,.860],[.72,.796]]);
  const railParameter=smoothSpline([[-1.44,.985],[-1.20,.90],[-.95,.80],[-.735,.72],[-.15,.72],[.18,.78],[.44,.90],[.72,.985]]);
  function canopyPoint(u,z){
    z=THREE.MathUtils.clamp(z,canopyMin,canopyMax);u=THREE.MathUtils.clamp(u,-1,1);
    const a=Math.abs(u),sign=Math.sign(u)||1,w=at(z)[0],belt=beltWidth(z),upper=roofWidth(z);
    const bodyAt=x=>topY(z,x/w),beltY=bodyAt(belt)+.002,delta=roofHeight(z)-beltY;
    const rise=.5*(delta+Math.sqrt(delta*delta+.000004))+.004;
    const height=beltY+rise,camber=.024*(1-Math.exp(-rise/.12));
    let x,y;
    if(a<=canopyJoin){const t=a/canopyJoin;x=upper*t;y=height-camber*t*t;}
    else{
      const range=1-canopyJoin,dx=upper*range/(5*canopyJoin),dy=-2*camber*range/(5*canopyJoin);
      const base=[upper,height-camber],end=[belt,beltY],edge=.024,epsilon=.0005;
      const slope=(bodyAt(belt+epsilon)-bodyAt(belt-epsilon))/(2*epsilon);
      const curvature=(bodyAt(belt+epsilon)-2*bodyAt(belt)+bodyAt(belt-epsilon))/(epsilon*epsilon);
      const p1=[base[0]+dx,base[1]+dy];
      const p2=[base[0]+2*dx,base[1]+2*dy-2*camber*range*range/(20*canopyJoin*canopyJoin)];
      const p4=[belt-edge,beltY-slope*edge];
      const p3=[belt-2*edge,beltY-2*slope*edge+1.25*curvature*edge*edge];
      [x,y]=bezier5([base,p1,p2,p3,p4,end],(a-canopyJoin)/range);
    }
    const blend=smooth01((z-canopyMin)/.17)*smooth01((canopyMax-z)/.17);
    y=THREE.MathUtils.lerp(bodyAt(x)+.002,y,blend);
    return new THREE.Vector3(sign*x,y,z);
  }
  function canopyNormal(u,z){
    const epsilon=.0001;
    const du=canopyPoint(u+epsilon,z).sub(canopyPoint(u-epsilon,z));
    const dz=canopyPoint(u,z+epsilon).sub(canopyPoint(u,z-epsilon));
    return dz.cross(du).normalize();
  }
  const canopyRows=144,canopyColumns=80,cv=[],cf=[];
  for(let j=0;j<=canopyRows;j++)for(let i=0;i<=canopyColumns;i++){
    cv.push(canopyPoint(i/canopyColumns*2-1,THREE.MathUtils.lerp(canopyMin,canopyMax,j/canopyRows)).toArray());
  }
  for(let j=0;j<canopyRows;j++)for(let i=0;i<canopyColumns;i++){const k=j*(canopyColumns+1)+i;cf.push([k,k+canopyColumns+1,k+canopyColumns+2,k+1]);}
  const canopy=surface(parts.glasshouse,'continuous-glass-canopy',cv,cf,glass);
  const canopyNormals=canopy.geometry.attributes.normal;
  for(let j=0;j<=canopyRows;j++)for(let i=0;i<=canopyColumns;i++){
    const normal=canopyNormal(i/canopyColumns*2-1,THREE.MathUtils.lerp(canopyMin,canopyMax,j/canopyRows));
    canopyNormals.setXYZ(j*(canopyColumns+1)+i,normal.x,normal.y,normal.z);
  }
  canopy.geometry.userData.grid={rows:canopyRows,columns:canopyColumns,minZ:canopyMin,maxZ:canopyMax};
  for(const s of [-1,1]) {
    const rail=[],seal=[];
    for(let i=0;i<=160;i++){
      const z=THREE.MathUtils.lerp(canopyMin,canopyMax,i/160),u=s*railParameter(z);
      rail.push(canopyPoint(u,z).addScaledVector(canopyNormal(u,z),.003).toArray());
      seal.push(canopyPoint(s,z).addScaledVector(canopyNormal(s,z),.001).toArray());
    }
    line(parts.body,`continuous-roof-rail-${s}`,rail,.010,paint);
    line(parts.trim,`window-seal-${s}`,seal,.0035,dark);
    // A tapered, curved rear sail follows the same glass surface and joins
    // the shoulder at the same position and normal. No pointed pillar block.
    const sailVertices=[],sailFaces=[],sailNormals=[],sailRows=48,sailColumns=12;
    for(let j=0;j<=sailRows;j++){
      const t=j/sailRows,z=THREE.MathUtils.lerp(-.735,-1.44,t);
      const inside=railParameter(z),outside=THREE.MathUtils.lerp(inside,1,smooth01(t/.58));
      for(let i=0;i<=sailColumns;i++){
        const u=s*THREE.MathUtils.lerp(inside,outside,i/sailColumns),n=canopyNormal(u,z);
        sailVertices.push(canopyPoint(u,z).addScaledVector(n,.0025).toArray());sailNormals.push(n);
      }
    }
    for(let j=0;j<sailRows;j++)for(let i=0;i<sailColumns;i++){const k=j*(sailColumns+1)+i;sailFaces.push([k,k+1,k+sailColumns+2,k+sailColumns+1]);}
    const sail=surface(parts.body,`rear-buttress-${s}`,sailVertices,sailFaces,doublePaint);
    sailNormals.forEach((n,i)=>sail.geometry.attributes.normal.setXYZ(i,n.x,n.y,n.z));
    box(parts.trim,`mirror-stalk-${s}`,[s*.953,.795,.50],[.154,.021,.027],dark,[0,0,s*.12]);
    roundedBox(parts.body,`mirror-housing-${s}`,[s*1.102,.812,.473],[.161,.067,.117],paint,.025,[0,s*.16,0]);
    roundedBox(parts.trim,`mirror-lens-${s}`,[s*1.106,.815,.410],[.126,.043,.010],alloy,.004,[0,s*.16,0]);
  }

  // A radiused nose replaces the old flat fascia and separate sharp cheeks.
  roundedBox(parts.frontFascia,'radiused-nose-fascia',[0,.451,2.180],[1.98,.386,.220],paint,.055);
  roundedBox(parts.frontFascia,'recessed-front-intake',[0,.345,2.296],[1.57,.139,.022],dark,.010);
  for(const s of [-1,1]) {
    const lampPoint=(x,z,lift=0)=>[s*x,topY(z,x/at(z)[0])+.009+lift,z];
    const housing=[lampPoint(.715,2.245),lampPoint(.966,1.827),lampPoint(1.002,1.913),lampPoint(.949,2.211)];
    polygon(parts.frontFascia,`headlamp-pocket-${s}`,s===1?housing:[...housing].reverse(),dark).material=dark.clone();
    parts.frontFascia.children.at(-1).material.side=THREE.DoubleSide;
    line(parts.lighting,`angular-headlight-${s}`,[lampPoint(.724,2.247,.007),lampPoint(.964,1.848,.007),lampPoint(.979,1.940,.007)],.009,headLED);
    line(parts.lighting,`headlight-inner-${s}`,[lampPoint(.760,2.211,.005),lampPoint(.949,1.953,.005)],.0045,headLED);
  }
  const lightPoints=Array.from({length:49},(_,i)=>{const x=THREE.MathUtils.lerp(-.94,.94,i/48);return [x,.640+.013*Math.pow(x/.94,6),2.292-.016*Math.pow(x/.94,8)];});
  line(parts.frontFascia,'lightbar-recess',lightPoints,.016,dark);
  line(parts.lighting,'front-lightbar',lightPoints.map(([x,y,z])=>[x,y,z+.012]),.0075,headLED);
  roundedPlate(parts.trim,'front-splitter',[[-1.031,1.91],[-1.031,2.18],[-.77,2.361],[.77,2.361],[1.031,2.18],[1.031,1.91]],.247,.024,.065,carbon);
  for(let i=-18;i<=18;i++) box(parts.frontFascia,`intake-vane-${i}`,[i*.039,.345,2.312],[.006,.095,.008],carbon);
  for(const y of [.314,.347,.379]) box(parts.frontFascia,'intake-horizontal-mesh',[0,y,2.314],[1.46,.004,.006],carbon);
  box(parts.frontFascia,'front-camera',[0,.389,2.319],[.060,.023,.012],dark);
  // Small geometric nose emblem (no font or image dependency).
  polygon(parts.trim,'nose-emblem',[[.032,.666,2.197],[-.032,.666,2.197],[-.022,.667,2.211],[-.006,.668,2.214],[-.006,.680,2.153],[.006,.680,2.153],[.006,.668,2.214],[.022,.667,2.211]],polished).material.side=THREE.DoubleSide;

  // Rear deck and signature red light, backed by a separate black optical housing.
  roundedBox(parts.rearFascia,'rear-bumper',[0,.601,-2.221],[2.023,.304,.076],paint,.034);
  box(parts.rearFascia,'rear-optical-housing',[0,.750,-2.257],[2.027,.042,.019],dark);
  line(parts.lighting,'full-width-taillight',[[-1.006,.754,-2.267],[-.86,.758,-2.285],[0,.758,-2.294],[.86,.758,-2.285],[1.006,.754,-2.267]],.010,tailLED);
  box(parts.rearFascia,'rear-blackout',[0,.369,-2.246],[1.99,.260,.076],dark);
  box(parts.trim,'diffuser-tray',[0,.221,-1.934],[1.88,.037,.72],carbon);
  for(let i=-3;i<=3;i++) box(parts.trim,`diffuser-fin-${i}`,[i*.245,.245,-2.047],[.014,.115,.51],carbon,[-.12,0,0]);
  const deckLip=Array.from({length:49},(_,i)=>{const x=THREE.MathUtils.lerp(-1.01,1.01,i/48),fraction=x/at(-2.226)[0];return [x,topY(-2.226,fraction)+.011,-2.239+.010*Math.pow(Math.abs(fraction),8)];});
  line(parts.body,'decklid-lip',deckLip,.010,paint);
  for(const s of [-1,1]) {
    box(parts.lighting,`rear-reflector-${s}`,[s*.913,.438,-2.291],[.139,.016,.008],tailLED);
    line(parts.trim,`rear-deck-panel-gap-${s}`,[[s*.714,.825,-1.43],[s*.70,.798,-1.91],[s*.70,.800,-2.18]],.002,dark);
  }
  const thrusters=[];
  for(const x of [-.735,-.493,.493,.735]) {
    const group=new THREE.Group(); group.name=`cold-gas-nozzle-${x}`; group.position.set(x,.361,-2.289);
    parts.thrusters.add(group);
    const p=[[.046,-.058],[.073,-.005],[.079,.020],[.077,.034],[.061,.034],[.056,.017],[.040,-.050]].map(p=>new THREE.Vector2(...p));
    const nozzle=mesh(new THREE.LatheGeometry(p,40),alloy,group,'machined-nozzle');
    nozzle.rotation.x=-Math.PI/2;
    const throat=mesh(new THREE.CircleGeometry(.045,32),dark,group,'recessed-nozzle-throat');
    throat.rotation.y=Math.PI; throat.position.z=.036;
    group.userData.direction=new THREE.Vector3(0,0,-1);
    group.userData.emitter=new THREE.Vector3(0,0,-.04);
    thrusters.push(group);
  }
  // Tiny rear lettering and plate are constructed from vector strokes.
  const glyphs={T:[[0,1,1,1],[.5,1,.5,0]],E:[[1,1,0,1],[0,1,0,0],[0,.5,.8,.5],[0,0,1,0]],
    S:[[1,1,0,1],[0,1,0,.5],[0,.5,1,.5],[1,.5,1,0],[1,0,0,0]],L:[[0,1,0,0],[0,0,1,0]],
    A:[[0,0,.5,1],[.5,1,1,0],[.2,.4,.8,.4]],R:[[0,0,0,1],[0,1,1,1],[1,1,1,.5],[1,.5,0,.5],[.5,.5,1,0]],
    O:[[0,0,0,1],[0,1,1,1],[1,1,1,0],[1,0,0,0]]};
  function letters(text,y,z,height,spacing,material) {
    const width=height*.63,advance=width+spacing,total=advance*text.length-spacing;
    for(let i=0;i<text.length;i++) for(const [a,b,c,d] of glyphs[text[i]]||[]) {
      const base=total/2-i*advance;
      line(parts.rearFascia,'rear-letter',[[base-a*width,y+b*height,z],[base-c*width,y+d*height,z]],.0015,material);
    }
  }
  letters('TESLA',.651,-2.253,.029,.038,polished);
  box(parts.rearFascia,'license-plate-frame',[0,.507,-2.290],[.294,.074,.014],alloy);
  box(parts.rearFascia,'license-plate',[0,.507,-2.300],[.278,.060,.005],dark);
  letters('ROSTR',.488,-2.305,.032,.008,whiteInk);

  // Four deep wheels: shaped tire profile, barrel, drilled rotors, floating
  // calipers, 5 swept spokes, polished rim edge, lug bolts, and a centre cap.
  const spinGroups=[],steeringGroups=[];
  const tireProfile=[
    [.283,-.132],[.320,-.132],[.349,-.118],[.365,-.095],[.370,-.065],
    [.370,.065],[.365,.095],[.349,.118],[.320,.132],[.283,.132],[.283,-.132]
  ].map(p=>new THREE.Vector2(...p));
  for(const [wi,zc] of wheelZ.entries()) for(const s of [-1,1]) {
    const mount=new THREE.Group();mount.name=`wheel-${wi===0?'front':'rear'}-${s===1?'left':'right'}`;
    mount.position.set(s*.952,wheelY,zc);parts.wheels.add(mount);
    const spin=new THREE.Group();spin.name='spin-X';mount.add(spin);spinGroups.push(spin);
    if(wi===0)steeringGroups.push(mount);
    const tire=mesh(new THREE.LatheGeometry(tireProfile,64),rubber,spin,'low-profile-tire');tire.rotation.z=Math.PI/2;
    const barrel=mesh(new THREE.CylinderGeometry(.289,.289,.236,64,1,true),dark,spin,'forged-barrel');
    barrel.rotation.z=Math.PI/2;
    torusX(spin,'machined-rim-lip',s*.135,.286,.006,polished);
    torusX(spin,'inner-rim-edge',-s*.115,.285,.004,alloy);
    torusX(spin,'sidewall-ridge',s*.128,.327,.002,rubber);
    for(const x of [-.065,-.023,.023,.065]) torusX(spin,'circumferential-tread-groove',x,.3705,.0014,dark);
    cylX(spin,'ventilated-brake-rotor',[s*.074,0,0],.247,.012,rotor,64);
    torusX(spin,'rotor-edge',s*.084,.24,.0018,alloy);
    // 36 dark drill holes distributed in staggered radial rows.
    const holeGeo=new THREE.CylinderGeometry(.0042,.0042,.0018,6);holeGeo.rotateZ(Math.PI/2);
    const holes=new THREE.InstancedMesh(holeGeo,dark,36);holes.name='drilled-rotor-holes';
    const matrix=new THREE.Matrix4();
    for(let i=0;i<36;i++) {const a=i/18*Math.PI*2,r=i<18?.211:.174;
      matrix.makeTranslation(s*.0818,Math.cos(a)*r,Math.sin(a)*r);holes.setMatrixAt(i,matrix);}
    spin.add(holes);
    const caliper=box(mount,'stationary-brake-caliper',[s*.095,.018,-.214],[.065,.145,.061],brake,[.1,0,0]);
    caliper.userData.stationary=true;
    for(let j=0;j<5;j++) {
      const angle=j/5*Math.PI*2;
      const coordinates=[[.061,-.20],[.126,-.13],[.278,.16],[.278,.35],[.166,.20],[.061,.30]];
      const verts=[];
      for(const x of [s*.100,s*.139]) for(const [r,a] of coordinates) verts.push([x,Math.cos(angle+a)*r,Math.sin(angle+a)*r]);
      const faces=[[0,5,4,3,2,1],[6,7,8,9,10,11]];
      for(let i=0;i<6;i++)faces.push([i,(i+1)%6,(i+1)%6+6,i+6]);
      const spoke=surface(spin,'swept-forged-spoke',verts,faces,dark);spoke.material=dark.clone();spoke.material.side=THREE.DoubleSide;
      const edge=[[.079,.23],[.165,.20],[.277,.34]].map(([r,a])=>[s*.141,Math.cos(angle+a)*r,Math.sin(angle+a)*r]);
      line(spin,'diamond-cut-spoke-edge',edge,.0045,polished);
    }
    cylX(spin,'metal-centre-cap',[s*.146,0,0],.062,.017,alloy,40);
    cylX(spin,'black-cap-inset',[s*.157,0,0],.041,.002,dark,32);
    for(let j=0;j<5;j++) {
      const a=j/5*Math.PI*2;
      cylX(spin,'titanium-lug-bolt',[s*.159,Math.cos(a)*.049,Math.sin(a)*.049],.006,.005,polished,6);
    }
    // Discrete molded tread sipes, instanced to keep the draw count low.
    const sipeGeo=new THREE.BoxGeometry(.073,.0014,.002);
    const sipes=new THREE.InstancedMesh(sipeGeo,dark,64);sipes.name='molded-tread-sipes';
    const dummy=new THREE.Object3D();
    for(let i=0;i<64;i++) {
      const a=i/64*Math.PI*2;dummy.position.set((i%2?.045:-.045),Math.cos(a)*.3709,Math.sin(a)*.3709);
      dummy.rotation.set(a,(i%2?1:-1)*.23,0);dummy.updateMatrix();sipes.setMatrixAt(i,dummy.matrix);
    }
    spin.add(sipes);
  }
  // Visible underside is enclosed. It does not fill the wheel arch openings.
  box(parts.trim,'flat-undertray',[0,.199,0],[1.70,.025,3.86],dark);
  const api={
    parts, wheels:spinGroups, steering:steeringGroups, thrusters,
    materials:{paint,glass,headLED,tailLED,amberLED},
    setPaint(color){paint.color.set(color);doublePaint.color.set(color);},
    setLights(on){for(const m of [headLED,tailLED,amberLED]){m.emissiveIntensity=on?(m===headLED?5:m===tailLED?4:3):0;m.color.set(on?(m===headLED?0xffffff:m===tailLED?0xff2440:0xffa31a):0x121418);}},
    setSteering(radians){for(const m of steeringGroups)m.rotation.y=THREE.MathUtils.clamp(radians,-.45,.45);},
    roll(distance){for(const w of spinGroups)w.rotation.x+=distance/.370;},
    dispose(){const gs=new Set(),ms=new Set();car.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);});for(const g of gs)g.dispose();for(const m of ms)m.dispose();}
  };
  car.userData={units:'metres',forward:'+Z',design:'independent angular Roadster concept'};
  // Object references and methods stay out of serializable userData so the
  // standard Object3D.toJSON()/exporter path cannot encounter parent cycles.
  for(const [key,value] of Object.entries(api))Object.defineProperty(car.userData,key,{value,enumerable:false});
  car.updateMatrixWorld(true);
  return car;
}
