import * as THREE from './vendor/three.module.js';

// A compact, entirely procedural city. Static details share instanced batches.
export function createWorld(scene) {
  const group = new THREE.Group();
  group.name = 'Longshot rooftop district';
  scene.add(group);
  const colliders = [];
  const disposable = [];
  const batches = new Map();
  let seed = 82197;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  function material(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({color, roughness: 0.84, metalness: 0.12, ...opts});
    disposable.push(m); return m;
  }
  const concrete = material(0x687675);
  const lightConcrete = material(0x8d9290);
  const darkConcrete = material(0x394b50);
  const warmConcrete = material(0x938578);
  const asphalt = material(0x263b40);
  const trim = material(0x32494c);
  const steel = material(0x1e3137, {roughness:0.52, metalness:0.65});
  const lightSteel = material(0x9aaba6, {roughness:0.45, metalness:0.7});
  const orange = material(0xd46336);
  const pale = material(0xc3b793);
  const aqua = material(0x36737b);
  const brick = material(0x71655c);
  const roofMat = material(0x4a5c5c);
  const glass = material(0x263f49, {roughness:0.22, metalness:0.6});
  const windows = [
    material(0xe6bb78,{emissive:0xffb66b,emissiveIntensity:0.45,roughness:0.4}),
    material(0x69868d,{emissive:0x6b989d,emissiveIntensity:0.12,roughness:0.4}),
    material(0x253d46,{roughness:0.26,metalness:0.65})
  ];
  const luminous = material(0xffb679,{emissive:0xff9e55,emissiveIntensity:2.0});
  const redLight = material(0xf14733,{emissive:0xff4930,emissiveIntensity:2.6});
  const batch = (geometry, mat, collision=false) => {
    const key = geometry.uuid + mat.uuid + (collision ? 'c':'n');
    if (!batches.has(key)) batches.set(key, {geometry,mat,collision,items:[]});
    return batches.get(key);
  };
  function shape(geometry,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0,collision=false) {
    position.set(x,y,z); scale.set(sx,sy,sz); euler.set(rx,ry,rz); rotation.setFromEuler(euler);
    matrix.compose(position,rotation,scale);
    batch(geometry,mat,collision).items.push(matrix.clone());
  }
  const box = (mat,x,y,z,w,h,d,collision=false,ry=0) => shape(boxGeo,mat,x,y,z,w,h,d,0,ry,0,collision);
  const cyl = (mat,x,y,z,r,h,rx=0,ry=0,rz=0,collision=false) => shape(cylinderGeo,mat,x,y,z,r*2,h,r*2,rx,ry,rz,collision);
  function beam(mat,a,b,r=0.12) {
    const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), mid=A.clone().add(B).multiplyScalar(.5);
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), B.clone().sub(A).normalize());
    matrix.compose(mid,q,new THREE.Vector3(r*2,A.distanceTo(B),r*2));
    batch(cylinderGeo,mat).items.push(matrix.clone());
  }
  function planeSign(text,x,y,z,w,h,foreground='#d7d4bc',background='#263a3e',ry=0) {
    const c=document.createElement('canvas'); c.width=1024;c.height=256;
    const ctx=c.getContext('2d'); ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);
    ctx.fillStyle=foreground;ctx.font='bold 88px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(text,512,128,960);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
    const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.9});
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
    mesh.position.set(x,y,z);mesh.rotation.y=ry;group.add(mesh);
    disposable.push(tex,mat,mesh.geometry);return mesh;
  }
  function concreteTexture() {
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d'); ctx.fillStyle='#5b6a68';ctx.fillRect(0,0,256,256);
    for(let i=0;i<4400;i++) {
      const v=60+Math.floor(rnd()*120); ctx.fillStyle=`rgba(${v},${v+3},${v},.12)`;
      ctx.fillRect(rnd()*256,rnd()*256,1+rnd()*2,1+rnd()*2);
    }
    ctx.strokeStyle='rgba(18,32,32,.35)';ctx.lineWidth=2;ctx.strokeRect(1,1,254,254);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(8,7);tex.anisotropy=4;
    disposable.push(tex);return tex;
  }

  scene.fog = new THREE.FogExp2(0xa4a3a0,0.00175);
  scene.background = new THREE.Color(0x7c9fa6);
  const hemi=new THREE.HemisphereLight(0xb7d9e3,0x795a47,2.0); group.add(hemi);
  const sun=new THREE.DirectionalLight(0xffd5aa,3.4);sun.position.set(-100,115,-120);
  sun.target.position.set(0,10,-35);group.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:5,far:310});
  sun.shadow.bias=-0.0008;sun.shadow.normalBias=.45;
  const fill=new THREE.DirectionalLight(0x8dbfce,.7);fill.position.set(80,50,60);group.add(fill);

  // Gradient sky and sun are one draw call, with a soft, off-axis sunset.
  const skyMat=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{sunDirection:{value:new THREE.Vector3(-.43,.17,-.88).normalize()}},
    vertexShader:'varying vec3 vWorld; void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`varying vec3 vWorld; uniform vec3 sunDirection;
    void main(){vec3 d=normalize(vWorld);float y=max(d.y,0.);
      vec3 horizon=vec3(.77,.69,.59);vec3 high=vec3(.27,.47,.56);
      vec3 col=mix(horizon,high,pow(clamp(y,0.,1.),.5));
      float s=max(dot(d,sunDirection),0.);col+=vec3(.25,.10,.015)*pow(s,20.);
      col=mix(col,vec3(1.,.82,.53),smoothstep(.9982,.9988,s));
      float haze=sin(d.x*19.+d.z*31.)*.008; col+=haze*(1.-y);
      gl_FragColor=vec4(col,1.);}`
  });
  const sky=new THREE.Mesh(new THREE.SphereGeometry(850,24,16),skyMat);sky.renderOrder=-10;group.add(sky);disposable.push(sky.geometry,skyMat);

  // Harbor on the west side; this surface has a deliberately inexpensive wave shader.
  const waterMat=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uSun:{value:new THREE.Vector3(-.43,.17,-.88).normalize()}},
    vertexShader:'varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform float uTime; uniform vec3 uSun; varying vec3 vWorld;
    void main(){float a=sin(vWorld.x*.30+vWorld.z*.19+uTime*.65);float b=sin(vWorld.z*1.1-vWorld.x*.1-uTime*.45);
      vec3 col=mix(vec3(.12,.29,.32),vec3(.29,.46,.46),a*.22+.4);
      float stripe=pow(max(0.,sin(vWorld.z*.6+uTime)),22.);
      float glow=exp(-pow((vWorld.x+140.)/65.,2.));
      col+=vec3(.50,.29,.12)*stripe*glow*.55;gl_FragColor=vec4(col,1.);}`
  });
  const water=new THREE.Mesh(new THREE.PlaneGeometry(650,650),waterMat);water.rotation.x=-Math.PI/2;water.position.set(-370,-.25,-100);group.add(water);disposable.push(water.geometry,waterMat);
  box(asphalt,75,-.8,-115,300,1.5,470,true);
  // Quay edge, roads, lane markings.
  box(lightConcrete,-76,1,-120,4,2,430,true);
  for(let z=-260;z<70;z+=11) box(pale,-48,.035,z,.16,.05,5);
  for(let x=-40;x<100;x+=11) box(pale,x,.035,-11,5,.05,.17);
  box(darkConcrete,-47,.05,-120,17,.1,400);
  box(darkConcrete,30,.06,-11,175,.1,14);

  // Our rooftop: a usable ledge, concrete seams, side equipment and strong foreground forms.
  box(darkConcrete,0,9.05,26,30,18.1,27,true);
  const roofSurface=material(0xffffff,{map:concreteTexture()});
  box(roofSurface,0,18.2,26,30,.2,27,true);
  box(lightConcrete,0,18.47,12.8,30,.34,.65,true);
  box(trim,0,18.68,12.8,30,.12,.83);
  // Low forward corners keep the near, low targets visible from the rear firing line.
  for (const side of [-14.5, 14.5]) {
    box(lightConcrete,side,18.47,16.4,.65,.34,7.8,true);
    box(trim,side,18.68,16.4,.85,.12,7.8);
    box(lightConcrete,side,18.9,29.9,.65,1.2,19.2,true);
    box(trim,side,19.55,29.9,.85,.12,19.2);
  }
  box(lightConcrete,0,18.9,39,30,1.2,.65,true);
  // Range boundary paint and numbers.
  for(let x=-10;x<=10;x+=2)box(orange,x,18.315,15.0,.8,.025,.2);
  for(let x of [-7,0,7]) {
    box(pale,x,18.32,21,3,.025,.08);
    box(pale,x-1.5,18.32,22,.08,.025,2);
    box(pale,x+1.5,18.32,22,.08,.025,2);
  }
  planeSign('LONGSHOT   /   ROOFTOP 07',0,17.1,12.42,17,2.2,'#e8b878','#354d51');
  // A service shed behind the player, not in the initial sightline.
  box(concrete,-5.5,21.2,35.7,11,5.8,7.6,true);
  box(trim,-5.5,24.2,35.7,11.5,.25,8);
  box(steel,-5.3,20.4,31.86,2.1,4.1,.12);
  for(let y=18.9;y<22;y+=.35) box(trim,-5.3,y,31.77,1.8,.04,.04);
  box(luminous,-5.3,23,31.7,1.2,.1,.18);
  planeSign('07 / OPERATIONS',-1,22.3,31.8,4,1,'#b8c9c7','#324a50');
  // Foreground rooftop vents and pipework.
  for(let x of [-12.5]) {
    box(lightSteel,x,19.5,29.5,2,2.4,3.1,true);
    box(steel,x,20.74,29.5,1.65,.07,2.6);
    for(let z=28.3;z<30.8;z+=.22)box(trim,x,20.81,z,1.55,.04,.06);
    box(trim,x,19.6,27.92,1.7,1.7,.05);
    for(let y=18.9;y<20.3;y+=.17)box(lightSteel,x,y,27.87,1.5,.045,.05);
  }
  for(let z of [31,33.5]) {
    box(aqua,10,19.0,z,3.7,1.3,1.8,true);
    box(steel,10,19.72,z,3.9,.1,2);
    for(let x=8.2;x<=11.8;x+=.3)box(lightSteel,x,19.78,z,.04,.02,1.85);
  }
  beam(lightSteel,[-12,18.6,32],[-12,18.6,16],.16);
  beam(lightSteel,[-12,18.6,16],[-8,18.6,16],.16);
  box(orange,12.4,18.9,18.5,1.1,1.2,1.1,true);
  box(steel,12.4,19.55,18.5,1.2,.12,1.2);
  box(warmConcrete,11,18.95,23,2.4,1.3,1.8,true);
  box(steel,11,19.65,23,2.5,.08,1.9);
  for(let x of [10.2,11.8])box(trim,x,19,23,.12,1.25,1.88);

  // Main target buildings step upwards into the distance to keep each lane visible.
  const targetPads = [
    {x:-25,y:14.1,z:-34,lane:'A1',width:12},
    {x:0,y:15.6,z:-42,lane:'A2',width:13},
    {x:29,y:16.8,z:-37,lane:'A3',width:12},
    {x:-39,y:18.1,z:-68,lane:'B1',width:10},
    {x:-10,y:22.1,z:-77,lane:'B2',width:12},
    {x:18,y:21.1,z:-77,lane:'B3',width:12},
    {x:42,y:25.1,z:-75,lane:'B4',width:10},
    {x:-29,y:31.1,z:-107,lane:'C1',width:12},
    {x:0,y:35.1,z:-114,lane:'C2',width:13},
    {x:31,y:35.1,z:-117,lane:'C3',width:12},
    {x:-42,y:43.1,z:-145,lane:'D1',width:10},
    {x:18,y:48.1,z:-157,lane:'D2',width:12}
  ];
  function building(x,z,w,d,h,mat,index,foreground=true) {
    box(mat,x,h/2,z,w,h,d,foreground);
    box(roofMat,x,h+.05,z,w+.35,.1,d+.35,foreground);
    box(lightConcrete,x,h-.25,z,w+.4,.22,d+.4);
    // Horizontal floor bands and layered window strips.
    const columns=Math.max(2,Math.floor(w/3.2));
    for(let floor=1;floor<h/3.8;floor++) {
      const y=floor*3.5-.3;
      if(y>h-1.1)continue;
      box(trim,x,y-1.25,z+d/2+.03,w,.13,.12);
      for(let col=0;col<columns;col++) {
        const xx=x-w/2+(col+.5)*w/columns;
        const wm=windows[rnd()<.25?0:rnd()<.32?1:2];
        box(wm,xx,y,z+d/2+.055,w/columns*.65,1.65,.07);
        box(trim,xx,y,z+d/2+.11,.055,1.7,.02);
      }
      // View-facing side facades: fewer panes than the detailed front.
      for(let col=0;col<Math.floor(d/3.7);col++) {
        const zz=z-d/2+(col+.5)*3.7;
        box(windows[rnd()<.28?0:2],x-w/2-.055,y,zz,.07,1.65,2.1);
        box(windows[rnd()<.28?0:2],x+w/2+.055,y,zz,.07,1.65,2.1);
      }
    }
    // Expansion joints and occasional external ducts.
    for(let xx=x-w/2+1;xx<x+w/2;xx+=w/3)box(trim,xx,h/2,z+d/2+.12,.09,h-.4,.12);
    if(index%2===0) {
      box(lightSteel,x+w/2+.5,h*.56,z,1,h*.88,1);
      for(let yy=2;yy<h;yy+=4)box(trim,x+w/2+.55,yy,z,1.15,.13,1.15);
    }
    // Keep roof front open for targets; equipment is on the rear corners.
    box(lightSteel,x-w*.33,h+1,z-d*.3,2.3,1.9,2.3);
    box(trim,x-w*.33,h+2,z-d*.3,2.5,.2,2.5);
    if(index%3===0) {
      cyl(lightSteel,x+w*.32,h+1.7,z-d*.3,1.6,3.4);
      cyl(trim,x+w*.32,h+3.46,z-d*.3,1.7,.2);
    }
  }
  targetPads.forEach((pad,i)=>{
    const height=pad.y-.1,depth=13;
    const materials=[concrete,warmConcrete,darkConcrete,brick];
    // Targets stand close to the front edge, exposing the whole silhouette.
    building(pad.x,pad.z-4,Math.max(17,pad.width+5),depth,height,materials[i%4],i);
    box(orange,pad.x,pad.y+.025,pad.z+.5,pad.width,.05,.3);
    box(steel,pad.x,pad.y+.12,pad.z,pad.width,.16,.25);
    // Two short edge markers make the lane easy to locate without huge labels.
    for(let side of [-1,1]){
      box(steel,pad.x+side*(pad.width/2+.6),pad.y+.55,pad.z,.22,1.1,.22);
      box(luminous,pad.x+side*(pad.width/2+.6),pad.y+1.15,pad.z,.35,.14,.35);
    }
    planeSign(pad.lane,pad.x,pad.y-1.4,pad.z+2.56,3,1.25,'#f0a05f','#263f44');
  });

  // Industrial flank, beyond the clear central field of fire.
  for(let i=0;i<5;i++) {
    const x=66+i%2*28,z=-45-i*35,h=15+rnd()*27;
    building(x,z,19+rnd()*8,20,h,i%2?brick:darkConcrete,20+i);
  }
  for(let i=0;i<3;i++) {
    const x=74+i*9,z=-160,h=63+i*5;
    cyl(warmConcrete,x,h/2,z,2.2,h,0,0,0,true);
    cyl(orange,x,h-7,z,2.25,4);
    cyl(steel,x,h+1,z,2.5,2);
    cyl(redLight,x,h+2.4,z,.28,.3);
  }
  // An open steel crane down at the harbor.
  const craneX=-86,craneZ=-105;
  for(let dx of [-4,4])for(let dz of [-4,4])beam(orange,[craneX+dx,0,craneZ+dz],[craneX+dx,52,craneZ+dz],.35);
  for(let y=4;y<52;y+=8){
    beam(orange,[craneX-4,y,craneZ+4],[craneX+4,y+8,craneZ+4],.15);
    beam(orange,[craneX+4,y,craneZ-4],[craneX-4,y+8,craneZ-4],.15);
  }
  box(orange,craneX-13,54,craneZ,49,1,5);
  box(orange,craneX-13,58,craneZ,49,.6,5);
  for(let x=craneX-36;x<craneX+11;x+=6) {
    beam(orange,[x,54,craneZ+2],[x+6,58,craneZ+2],.14);
    beam(orange,[x,58,craneZ-2],[x+6,54,craneZ-2],.14);
  }
  box(aqua,craneX+8,52,craneZ,5,5,6);
  box(glass,craneX+8,52.7,craneZ+3.05,4.2,2.3,.1);
  beam(steel,[craneX-28,54,craneZ],[craneX-28,15,craneZ],.05);
  box(orange,craneX-28,14,craneZ,1,2,1);

  // Stacked shipping containers, bollards and small service vehicles.
  for(let i=0;i<18;i++) {
    const x=-61+(i%2)*9,z=-27-Math.floor(i/2)*16,y=i%5===0?4.2:1.5;
    const mat=[aqua,orange,darkConcrete,warmConcrete][i%4];
    box(mat,x,1.5,z,7,3,12,true);
    if(y>2)box(mat,x,4.5,z,7,3,12,true);
    for(let zz=z-5.8;zz<z+6;zz+=.8)box(trim,x-3.55,1.5,zz,.07,2.8,.07);
    box(steel,x,1.5,z+6.04,.10,2.7,.08);
  }
  for(let z=-250;z<40;z+=18){cyl(steel,-76.5,1.9,z,.42,1.5);box(luminous,-74.8,2.4,z,.14,.15,.14);}
  // Cargo barge in the water.
  box(steel,-115,1,-55,18,3,55);
  box(warmConcrete,-115,3.1,-35,12,1,9);
  box(lightConcrete,-115,6,-35,9,5,7);
  box(glass,-115,6.5,-31.45,7.8,2,.1);
  for(let i=0;i<5;i++)box(i%2?aqua:orange,-115,4.4,-48-i*7,12,3.7,6);

  // The distant skyline: large blocks plus instanced strips read well under magnification.
  for(let i=0;i<65;i++) {
    const x=-175+rnd()*520,z=-250-rnd()*230,w=10+rnd()*24,d=12+rnd()*18,h=25+rnd()*78;
    const chosen=[darkConcrete,concrete,warmConcrete][i%3];
    box(chosen,x,h*.5,z,w,h,d);
    box(trim,x,h+.5,z,w+.4,1,d+.4);
    if(i%5===0){box(steel,x,h+5,z,1.1,10,1.1);cyl(redLight,x,h+10.1,z,.25,.5);}
    for(let floor=4;floor<h-2;floor+=5.5) {
      box(i%3===0?windows[2]:windows[1],x,floor,z+d/2+.06,w*.88,1.65,.10);
      if(i%4===0)box(windows[0],x-w*.18,floor,z+d/2+.12,w*.18,1.6,.08);
    }
  }
  // Soft mountain silhouettes behind everything.
  const mountainMat=material(0x71878b,{roughness:1});
  for(let i=0;i<22;i++) {
    const geometry=new THREE.ConeGeometry(45+rnd()*55,60+rnd()*100,4,1);
    const mesh=new THREE.Mesh(geometry,mountainMat);
    mesh.position.set(-530+i*54,20,-630-rnd()*80);mesh.rotation.y=rnd()*3;
    group.add(mesh);disposable.push(geometry);
  }
  // Flush batches: even thousands of individual panes remain a few draw calls.
  batches.forEach(({geometry,mat,collision,items})=>{
    const mesh=new THREE.InstancedMesh(geometry,mat,items.length);
    items.forEach((m,i)=>mesh.setMatrixAt(i,m));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=collision;mesh.receiveShadow=collision;
    mesh.computeBoundingSphere();group.add(mesh);
    if(collision)colliders.push(mesh);
  });
  disposable.push(boxGeo,cylinderGeo);
  const spawn=new THREE.Vector3(0,20,24);
  return {
    spawn,
    bounds:{minX:-9,maxX:9,minZ:15,maxZ:29},
    targetPads,
    colliders,
    update(dt,time){waterMat.uniforms.uTime.value=time;},
    dispose(){scene.remove(group);disposable.forEach(x=>x.dispose?.());}
  };
}
