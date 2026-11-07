import * as THREE from './vendor/three.module.js';

// Ink & Iron: a hand-inked, fully procedural 1965 propaganda district.
export function createWorld(scene, { mobile = false } = {}) {
  const INK = '#1c1926', PAPER = '#fff0cc';
  const colors = { ink: INK, paper: PAPER, brick: '#bc654f', clay: '#dc8b61', teal: '#508c91', blue: '#577789', mauve: '#78556e', ochre: '#e0aa56', yellow: '#ffd05b', rust: '#9b554c' };
  const staticRoot = new THREE.Group(); scene.add(staticRoot);
  const animated = new THREE.Group(); scene.add(animated);
  const colliders = [], smoke = [], fans = [], rainCount = mobile ? 200 : 400;
  let seed = 7717;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const random = (a, b) => a + rand() * (b - a);
  const gradient = new THREE.DataTexture(new Uint8Array([72, 146, 226, 255]), 4, 1, THREE.RedFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
  const mats = new Map();
  function mat(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!mats.has(key)) mats.set(key, new THREE.MeshToonMaterial({color, gradientMap:gradient, ...options}));
    return mats.get(key);
  }
  const ink = new THREE.MeshBasicMaterial({color:INK, side:THREE.BackSide});
  const lineMat = new THREE.LineBasicMaterial({color:INK});
  function outlineGeometry(geo, amount = .045) {
    const g = geo.clone();
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    if(n) for(let i=0;i<p.count;i++) p.setXYZ(i,p.getX(i)+n.getX(i)*amount,p.getY(i)+n.getY(i)*amount,p.getZ(i)+n.getZ(i)*amount);
    p.needsUpdate = true;
    return g;
  }
  function shape(geo, color, parent = staticRoot, pos = [0,0,0], rot = [0,0,0], outline = true) {
    const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
    m.position.set(...pos); m.rotation.set(...rot); m.castShadow = !m.material.isMeshBasicMaterial; m.receiveShadow = true;
    if(outline) { const o = new THREE.Mesh(outlineGeometry(geo),ink); o.userData.ink=true; m.add(o); }
    parent.add(m); return m;
  }
  function box(w,h,d,color,parent=staticRoot,pos=[0,0,0],rot=[0,0,0],outline=true) {return shape(new THREE.BoxGeometry(w,h,d),color,parent,pos,rot,outline);}
  function cyl(r1,r2,h,color,parent=staticRoot,pos=[0,0,0],rot=[0,0,0],segs=12,outline=true) {return shape(new THREE.CylinderGeometry(r1,r2,h,segs),color,parent,pos,rot,outline);}
  function sphere(r,color,parent=staticRoot,pos=[0,0,0],scale=[1,1,1],outline=true) {const m=shape(new THREE.SphereGeometry(r,12,8),color,parent,pos,[0,0,0],outline);m.scale.set(...scale);return m;}
  function tube(points,r,color,parent=staticRoot,outline=true) {return shape(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*4),r,6,false),color,parent,[0,0,0],[0,0,0],outline);}
  function canvas(w,h,draw) {const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');draw(ctx,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
  function planeTexture(texture,w,h,parent=staticRoot,pos=[0,0,0],rot=[0,0,0],opts={}) {
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide,...opts}));m.position.set(...pos);m.rotation.set(...rot);parent.add(m);return m;
  }
  function sign(text,w,h,parent,pos,opts={}) {
    const bg=opts.bg||INK, fg=opts.fg||PAPER;
    const tex=canvas(1024,Math.round(1024*h/w),(ctx,cw,ch)=>{
      ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);ctx.strokeStyle=fg;ctx.lineWidth=8;ctx.strokeRect(12,12,cw-24,ch-24);
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.floor(ch*.61)}px ${opts.font||'Impact, Arial Narrow, sans-serif'}`;
      ctx.fillStyle=fg;ctx.fillText(text,cw/2,ch*.54,cw-60);
      if(opts.neon) {ctx.shadowColor=fg;ctx.shadowBlur=16;ctx.fillText(text,cw/2,ch*.54,cw-60);}
    });
    const g=new THREE.Group();g.position.set(...pos);parent.add(g);
    box(w+.18,h+.18,.18,INK,g,[0,0,-.12],undefined,false);
    planeTexture(tex,w,h,g,[0,0,0]);
    // Glow is painted into the sign texture; no detached mesh animation after merging.
    if(opts.neon) rand();
    return g;
  }
  function addCollider(x,z,w,d,height) {colliders.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,height});}
  function colliderFromObject(object) {
    object.updateWorldMatrix(true,true);
    const b=new THREE.Box3().setFromObject(object);
    colliders.push({minX:b.min.x,maxX:b.max.x,minZ:b.min.z,maxZ:b.max.z,height:b.max.y});
  }

  // Saturated atmospheric backdrop with a huge setting sun and graphic cloud silhouettes.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(230,24,12), new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, uniforms:{},
    vertexShader:'varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec3 vPosition;void main(){float h=normalize(vPosition).y;vec3 bottom=vec3(1.0,.60,.33);vec3 middle=vec3(.82,.36,.41);vec3 top=vec3(.28,.19,.36);vec3 c=mix(bottom,middle,smoothstep(-.12,.24,h));c=mix(c,top,smoothstep(.18,.77,h));gl_FragColor=vec4(c,1.);}'
  })); sky.renderOrder=-100;scene.add(sky);
  scene.fog=new THREE.Fog('#ba766c',42,145);
  const sunMat=new THREE.MeshBasicMaterial({color:'#ffcf77',fog:false,depthWrite:false});
  const sun=shape(new THREE.CircleGeometry(17,64),sunMat,staticRoot,[-12,31,-109],[0,0,0],false);sun.renderOrder=-50;
  const halo=shape(new THREE.RingGeometry(18.2,18.4,64),new THREE.MeshBasicMaterial({color:'#f8a768',fog:false,transparent:true,opacity:.75,depthWrite:false}),staticRoot,[-12,31,-110],[0,0,0],false);
  for(let i=0;i<18;i++) {
    const g=new THREE.Group();g.position.set(random(-100,100),random(35,66),random(-115,-85));staticRoot.add(g);
    const c=i%3===0?'#78516e':'#63435f';
    for(let k=0;k<4;k++) sphere(random(2.5,5),new THREE.MeshBasicMaterial({color:c,fog:false}),g,[k*4,Math.sin(k*2+i)*1.2,0],[1.9,.5,.7],false);
  }
  const hemi=new THREE.HemisphereLight('#ffe6b3','#745268',2.1);scene.add(hemi);
  const sunLight=new THREE.DirectionalLight('#ffe1a6',2.65);sunLight.position.set(-24,42,15);sunLight.castShadow=true;
  sunLight.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sunLight.shadow.camera.left=-36;sunLight.shadow.camera.right=36;sunLight.shadow.camera.top=36;sunLight.shadow.camera.bottom=-36;sunLight.shadow.camera.far=110;sunLight.shadow.bias=-.0007;sunLight.shadow.normalBias=.04;scene.add(sunLight);
  const rim=new THREE.DirectionalLight('#b39be7',1.3);rim.position.set(16,18,-24);scene.add(rim);

  // Cobblestone roads, raised sidewalks, tram rails and puddles are all painted locally.
  const cobbles=canvas(512,512,(ctx,w,h)=>{
    ctx.fillStyle='#4e4147';ctx.fillRect(0,0,w,h);
    for(let row=0;row<12;row++)for(let col=-1;col<10;col++) {
      const x=col*56+(row%2)*28,y=row*44;
      const light=rand();ctx.fillStyle=light<.3?'#8f7976':light<.65?'#a58d82':'#b39a88';
      ctx.beginPath();ctx.roundRect(x+3,y+3,50,37,5);ctx.fill();
      ctx.strokeStyle='#473841';ctx.lineWidth=2;ctx.stroke();
      ctx.strokeStyle='rgba(248,207,163,.25)';ctx.beginPath();ctx.moveTo(x+8,y+7);ctx.lineTo(x+47,y+7);ctx.stroke();
    }
  });cobbles.wrapS=cobbles.wrapT=THREE.RepeatWrapping;cobbles.repeat.set(19,23);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,120),new THREE.MeshToonMaterial({color:'#ded0b9',map:cobbles,gradientMap:gradient}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;staticRoot.add(ground);
  for(const side of [-1,1]) {
    box(7,.20,70,'#b7a59a',staticRoot,[side*18.4,.05,-1],undefined,false);
    box(.14,.27,70,INK,staticRoot,[side*14.9,.13,-1],undefined,false);
    for(let i=0;i<24;i++)box(6.8,.015,.045,'#7c6c6a',staticRoot,[side*18.4,.158,-34+i*3],undefined,false);
    box(.09,.025,65,'#3e3440',staticRoot,[side*2.15,.025,-1],undefined,false);
    box(.035,.028,65,'#e8af8d',staticRoot,[side*2.08,.03,-1],undefined,false);
  }
  const puddleMat=new THREE.MeshBasicMaterial({color:'#f6bc8b',transparent:true,opacity:.27,depthWrite:false});
  for(let i=0;i<12;i++) {const p=shape(new THREE.CircleGeometry(random(.6,1.7),18),puddleMat,staticRoot,[random(-13,13),.035,random(-21,21)],[-Math.PI/2,0,rand()*5],false);p.scale.y=random(.28,.8);}
  for(let i=0;i<11;i++)box(.13,.015,1.3,'#e2b77c',staticRoot,[0,.04,-21+i*4.3],undefined,false);

  function facadeTexture(style='factory',accent='#cb925e') {
    return canvas(512,768,(ctx,w,h)=>{
      ctx.fillStyle=accent;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(30,23,35,.28)';ctx.lineWidth=2;
      for(let row=0;row<28;row++){const y=row*28;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();for(let j=0;j<7;j++){const x=j*86+(row%2)*43;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+28);ctx.stroke();}}
      const cols=style==='factory'?4:3,rows=style==='factory'?4:3;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const ww=style==='factory'?78:108,hh=style==='factory'?119:148,xx=25+x*(w-38)/cols,yy=32+y*(h-58)/rows;
        ctx.fillStyle=INK;ctx.fillRect(xx-7,yy-7,ww+14,hh+17);
        ctx.fillStyle=rand()<.35?'#e7b067':'#526976';ctx.fillRect(xx,yy,ww,hh);
        ctx.fillStyle='rgba(35,27,40,.50)';ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+ww,yy);ctx.lineTo(xx,yy+hh);ctx.fill();
        ctx.fillStyle=INK;ctx.fillRect(xx+ww*.48,yy,5,hh);ctx.fillRect(xx,yy+hh*.5,ww,6);
        ctx.fillStyle='#ddc39f';ctx.fillRect(xx-8,yy+hh+7,ww+16,8);
        if(rand()<.23){ctx.strokeStyle='#252031';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(xx+ww*.7,yy);ctx.lineTo(xx+ww*.48,yy+hh*.34);ctx.lineTo(xx+ww*.81,yy+hh*.53);ctx.lineTo(xx+ww*.43,yy+hh*.83);ctx.stroke();}
      }
    });
  }
  function building(x,z,w,h,d,color,{angle=0,style='factory',name=null,accent=null,roof='stepped'}={}) {
    const group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=angle;staticRoot.add(group);
    box(w,h,d,color,group,[0,h/2,0]);
    box(w+.55,.48,d+.4,INK,group,[0,h+.15,0],undefined,false);
    box(w+.8,.23,d+.65,'#e4bd97',group,[0,h+.45,0]);
    box(w+.35,.32,d+.3,'#dbc4a3',group,[0,.29,0]);
    for(const yy of [h*.32,h*.66])box(w+.18,.19,d+.14,'#deb99b',group,[0,yy,0]);
    const tx=facadeTexture(style,accent||color);
    planeTexture(tx,w-.32,h-1.9,group,[0,h/2+.3,d/2+.048]);
    for(const side of [-1,1])box(.42,h+.1,.34,'#c69a7e',group,[side*(w/2-.2),h/2,d/2+.12]);
    if(roof==='stepped') {box(w*.48,1.15,d*.8,color,group,[0,h+.8,-.15]);box(w*.30,.8,d*.65,color,group,[0,h+1.6,-.3]);}
    if(roof==='sawtooth')for(let i=0;i<3;i++){
      const g=new THREE.ConeGeometry(w/6,1.55,4);shape(g,'#523e50',group,[-w/3+i*w/3,h+1,0],[0,Math.PI/4,0]);
    }
    if(name)sign(name,w*.92,1.04,group,[0,2.5,d/2+.21],{bg:INK,fg:accent||PAPER});
    // Rooftop exposed conduit and graphic scars.
    if(rand()<.75) {
      cyl(.55,.6,2.5,'#79616a',group,[w*.29,h+1.7,0]);cyl(.78,.78,.16,INK,group,[w*.29,h+3,0],undefined,12,false);
    }
    for(let i=0;i<3;i++)box(random(.5,1.6),.11,.10,INK,group,[-w*.28+i*w*.21,h*.83-rand(),d/2+.11],[0,0,random(-.4,.4)],false);
    // Since buildings are outside the arena, conservative bounding boxes suffice.
    const rw=Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*d,rd=Math.abs(Math.cos(angle))*d+Math.abs(Math.sin(angle))*w;
    addCollider(x,z,rw,rd,h);
    return group;
  }

  // Streetside facades look inward and frame a central Ministry building.
  const leftA=building(-23.6,8,13,12,10,colors.brick,{angle:Math.PI/2,style:'residential',accent:'#b96555'});
  const leftB=building(-23.2,-7.3,15,17,9.2,colors.teal,{angle:Math.PI/2,accent:'#5c8b8b',roof:'sawtooth'});
  const leftC=building(-24,-22,11,13,11,colors.clay,{angle:Math.PI/2,accent:'#ce8a68'});
  const rightA=building(24,10,12,15,10.6,colors.ochre,{angle:-Math.PI/2,style:'residential',accent:'#b59665'});
  const rightB=building(24,-4.4,14,11,10,colors.mauve,{angle:-Math.PI/2,accent:'#876775'});
  const rightC=building(24,-20,15,20,11,colors.blue,{angle:-Math.PI/2,accent:'#5d7c8c',roof:'sawtooth'});
  sign('INFORMANT!',7.4,1.8,leftB,[0,5,4.88],{fg:'#ffdb75',neon:true});
  sign('ON THE RECORD!',8.6,1.45,rightB,[0,6.4,5.3],{fg:'#8ce3d4',neon:true});
  sign('CLOSED FOR THE WAR',8.4,.85,leftA,[0,2.25,5.23],{fg:'#f0cda1'});
  sign('THE DAILY ALIBI',8.7,1.0,rightA,[0,3.15,5.52],{fg:PAPER});
  // Projecting blade signs visible when looking straight down the street.
  const bladeLeft=new THREE.Group();bladeLeft.position.set(-17.9,8.6,-7);staticRoot.add(bladeLeft);
  box(.15,4.5,1.9,INK,bladeLeft);const btex=canvas(180,720,(ctx,w,h)=>{ctx.fillStyle='#f9c95d';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle=INK;ctx.font='900 117px Impact, sans-serif';for(let i=0;i<4;i++)ctx.fillText('NEWS'[i],w/2,153+i*171);});
  planeTexture(btex,1.05,4.2,bladeLeft,[.14,0,.99]);
  box(.15,.13,2.7,INK,staticRoot,[-17.9,10.8,-7.4]);

  const ministry=building(0,-31,25,14,11,'#c19e88',{accent:'#c19e88'});
  // A monumental central portico makes the focal building architectural.
  box(9.5,11.9,1.1,'#e4c6a0',ministry,[0,6.25,5.8]);
  box(10.3,.45,1.7,'#312b3b',ministry,[0,12.35,5.9]);
  for(const x of [-4.6,-3.2,3.2,4.6]){
    box(.56,10.4,.65,'#f2d3a3',ministry,[x,5.8,6.25]);
    box(.7,.25,.8,INK,ministry,[x,.75,6.25]);
  }
  const archtex=canvas(640,800,(ctx,w,h)=>{
    ctx.fillStyle='#241e2d';ctx.fillRect(0,0,w,h);ctx.fillStyle='#38303e';ctx.fillRect(30,30,w-60,h-30);
    ctx.strokeStyle='#cf986f';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(100,h);ctx.lineTo(100,300);ctx.bezierCurveTo(100,50,540,50,540,300);ctx.lineTo(540,h);ctx.stroke();
    for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(135+i*61,260);ctx.lineTo(135+i*61,h);ctx.stroke();}
    ctx.fillStyle='#dcb47e';ctx.textAlign='center';ctx.font='900 49px Impact, sans-serif';ctx.fillText('NOTHING TO HIDE',320,400,480);
    ctx.font='22px monospace';ctx.fillText('EXCEPT THE TRUTH',320,450);ctx.fillStyle='#0f1522';ctx.fillRect(30,620,580,20);
  });planeTexture(archtex,5.8,7.1,ministry,[0,4.3,6.40]);
  sign('MINISTRY OF TRUTH',23.8,1.7,ministry,[0,14.15,5.75],{bg:INK,fg:PAPER});
  sign('SMILE. YOU ARE BEING RECORDED.',12,.68,ministry,[0,12.9,6.65],{bg:'#bc5849',fg:PAPER});
  // Giant eye insignia, not a copied faction symbol.
  const eyeTex=canvas(512,512,(ctx,w,h)=>{
    ctx.fillStyle='#f4c15c';ctx.beginPath();ctx.arc(256,256,240,0,Math.PI*2);ctx.fill();ctx.strokeStyle=INK;ctx.lineWidth=21;ctx.stroke();
    ctx.fillStyle=INK;ctx.beginPath();ctx.moveTo(62,256);ctx.quadraticCurveTo(256,43,450,256);ctx.quadraticCurveTo(256,469,62,256);ctx.fill();
    ctx.fillStyle=PAPER;ctx.beginPath();ctx.ellipse(256,256,97,105,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=INK;ctx.beginPath();ctx.arc(256,256,54,0,Math.PI*2);ctx.fill();ctx.fillStyle=PAPER;ctx.beginPath();ctx.moveTo(256,256);ctx.lineTo(309,222);ctx.lineTo(306,256);ctx.fill();
  });planeTexture(eyeTex,3.2,3.2,ministry,[0,9.9,6.4],undefined,{transparent:true,alphaTest:.1});
  for(let i=0;i<3;i++)box(11-i*.5,.16,2.5-i*.5,'#b09e8c',staticRoot,[0,.08+i*.16,-24.7-i*.25]);

  // Industrial skyline: towers, sawtooth roofs and smoke curls.
  for(let i=0;i<20;i++){
    const x=-76+i*8.5,z=-57-rand()*22,h=random(8,25),c=i%2?'#785367':'#8d5e70';
    box(random(4,8),h,random(6,11),new THREE.MeshBasicMaterial({color:c}),staticRoot,[x,h/2,z],undefined,false);
    if(i%3===0)box(2.2,4,3.5,new THREE.MeshBasicMaterial({color:c}),staticRoot,[x,h+2,z],undefined,false);
  }
  const chimneyPositions=[[-31,-36,27],[-18,-48,34],[29,-40,29],[36,-47,39]];
  for(const [x,z,h] of chimneyPositions) {
    cyl(1.25,2,h,'#74505e',staticRoot,[x,h/2,z],undefined,14);
    for(let j=0;j<4;j++)cyl(1.25+(1-j/4)*.55,1.25+(1-j/4)*.55,.45,'#392d42',staticRoot,[x,h*(.2+j*.2),z],undefined,14,false);
    cyl(1.65,1.65,.9,'#302638',staticRoot,[x,h+.1,z]);
    for(let j=0;j<6;j++){
      const puff=sphere(1.8+j*.35,new THREE.MeshBasicMaterial({color:j<2?'#544052':'#73516b',transparent:true,opacity:.82-j*.075,depthWrite:false}),animated,[x+j*.9,h+1.8+j*1.6,z-j*.3],[1.3,.65,.9],false);
      smoke.push({mesh:puff,x:puff.position.x,y:puff.position.y,phase:rand()*10});
    }
  }
  // Surveillance gantry with a friendly-looking but very unfriendly rotating eye.
  const tower=new THREE.Group();tower.position.set(14.1,0,-20);staticRoot.add(tower);
  for(const x of [-1,1])for(const z of [-1,1])box(.23,13,.23,INK,tower,[x,6.5,z]);
  for(let y=2;y<13;y+=3) {box(2.4,.2,2.4,INK,tower,[0,y,0]);tube([[-1,y,-1],[1,y+2,-1]],.07,'#403444',tower,false);tube([[1,y,-1],[-1,y+2,-1]],.07,'#403444',tower,false);}
  box(3,2.2,3,'#cf9a64',tower,[0,13.4,0]);box(3.5,.4,3.5,INK,tower,[0,14.7,0]);
  box(2.6,.85,.1,'#29333c',tower,[0,13.5,1.55]);
  const searchGroup=new THREE.Group();searchGroup.position.set(14.1,15.45,-20);animated.add(searchGroup);
  cyl(.65,.74,1.6,'#d9b776',searchGroup,[0,0,0],[Math.PI/2,0,0]);cyl(.59,.59,.05,mat('#ffe9a7',{emissive:'#ffc54f',emissiveIntensity:.7}),searchGroup,[0,0,.81],[Math.PI/2,0,0],16,false);
  fans.push(searchGroup);
  // The tower is open below the cabin: collide with its four visible legs.
  for(const x of [-1,1])for(const z of [-1,1])addCollider(14.1+x,-20+z,.32,.32,13);

  // Bent street lamps and drooping cables reinforce the rounded cartoon silhouette.
  for(const side of [-1,1])for(const z of [-14,3,19]) {
    const x=side*13.2;
    cyl(.18,.28,5.4,'#3b3442',staticRoot,[x,2.7,z]);
    cyl(.48,.6,.35,'#3b3442',staticRoot,[x,.18,z]);
    tube([[x,5.2,z],[x,6.2,z],[x-side*.7,6.6,z],[x-side*1.5,6.5,z],[x-side*1.8,5.95,z]],.13,'#3b3442');
    cyl(.55,.82,.45,INK,staticRoot,[x-side*1.8,5.84,z]);
    cyl(.65,.65,.08,mat('#ffdc82',{emissive:'#ffbb4e',emissiveIntensity:.6}),staticRoot,[x-side*1.8,5.58,z],undefined,16,false);
    addCollider(x,z,1.2,1.2,.35);addCollider(x,z,.42,.42,5.4);
  }
  for(const z of [-14,3])tube([[-24,11,z],[-11,8,z-1],[1,7.5,z-1.5],[13,9,z-1],[24,12,z]],.035,INK,staticRoot,false);
  tube([[-20,16,-6],[-8,14,-16],[5,14.5,-20],[22,18,-20]],.03,INK,staticRoot,false);
  // Faded bunting: ridiculous wartime festivities.
  for(let i=0;i<9;i++){
    const x=-13+i*3,y=8.8-Math.sin(i/8*Math.PI)*1.15,z=2.1;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([x-.5,y,z,x+.5,y,z,x,y-.9,z],3));geo.computeVertexNormals();
    shape(geo, new THREE.MeshBasicMaterial({color:i%2?'#b96156':'#d7bd91',side:THREE.DoubleSide}),staticRoot,[0,0,0],undefined,false);
  }

  // Cover: tape-striped ammunition boxes, stacked sandbags and an abandoned delivery van.
  const stripeTex=canvas(256,128,(ctx,w,h)=>{ctx.fillStyle='#e9b956';ctx.fillRect(0,0,w,h);ctx.fillStyle=INK;for(let i=-128;i<384;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+28,0);ctx.lineTo(i+156,h);ctx.lineTo(i+128,h);ctx.fill();}ctx.strokeStyle=INK;ctx.lineWidth=10;ctx.strokeRect(0,0,w,h);});
  function crate(x,z,w=2.4,d=1.6,h=1.3,angle=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;staticRoot.add(g);
    box(w,h,d,'#988c70',g,[0,h/2,0]);
    for(const xx of [-w*.38,w*.38])box(.16,h+.08,d+.09,'#3d3740',g,[xx,h/2,0]);
    for(const zz of [-d/2,d/2]){planeTexture(stripeTex,w-.12,.4,g,[0,h*.65,zz+(zz>0?.02:-.02)],[0,zz>0?0:Math.PI,0]);}
    box(w-.28,.10,.7,'#675d54',g,[0,h+.06,0]);
    colliderFromObject(g);
  }
  crate(-7.6,4.2,3.8,1.8,1.5,-.14);crate(7.1,-7.7,3.4,2,1.45,.13);crate(-7,-15,2.5,2,1.35,.17);
  crate(11.2,13.5,2.6,2,1.35,-.3);
  function sandbags(x,z,angle=0) {
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;staticRoot.add(g);
    for(let row=0;row<2;row++)for(let i=0;i<4-row;i++)sphere(.48,'#c8ad7c',g,[-1.35+i*.88+row*.44,.3+row*.48,0],[1.2,.52,.74]);
    colliderFromObject(g);
  }
  sandbags(6.3,4.4);sandbags(-9,-6.2,.3);
  const van=new THREE.Group();van.position.set(-11.5,0,13.2);van.rotation.y=.16;staticRoot.add(van);
  box(2.6,1.7,4.8,'#7c9891',van,[0,1.6,0]);box(2.65,.75,2.1,'#78a397',van,[0,.85,3]);box(2.4,1.5,1.6,'#8caf9e',van,[0,1.82,2]);
  box(2.2,.85,.07,'#303748',van,[0,2.0,2.85]);box(.1,1.05,.12,'#cbbf93',van,[0,1.96,2.91]);
  box(2.75,.26,.4,INK,van,[0,.5,4.1]);box(1.3,.5,.15,INK,van,[0,1,4.09]);
  for(const xx of [-.93,.93]){sphere(.26,'#f4d58f',van,[xx,1.1,4.1],[1,1,.4]);for(const zz of [-1.5,2.5])cyl(.6,.6,.27,INK,van,[xx*1.38,.56,zz],[0,0,Math.PI/2],14);}
  sign('DELIVERING THE TRUTH',3.5,.65,van,[0,1.8,-2.44],{bg:'#7c9891',fg:PAPER}).rotation.y=Math.PI;
  colliderFromObject(van);

  function poster(text,sub,x,y,z,angle=0,theme='eye'){
    const tex=canvas(480,660,(ctx,w,h)=>{
      ctx.fillStyle='#e9ce9b';ctx.fillRect(0,0,w,h);ctx.fillStyle='#a84943';ctx.fillRect(15,15,w-30,h-30);ctx.fillStyle='#f0d8a7';ctx.fillRect(32,32,w-64,h-64);
      ctx.fillStyle=INK;ctx.font='900 70px Impact, sans-serif';ctx.textAlign='center';ctx.fillText(text,w/2,111,w-75);
      if(theme==='eye'){
        ctx.beginPath();ctx.moveTo(65,295);ctx.quadraticCurveTo(240,75,415,295);ctx.quadraticCurveTo(240,515,65,295);ctx.fill();ctx.fillStyle='#eee2b8';ctx.beginPath();ctx.ellipse(240,295,80,100,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=INK;ctx.beginPath();ctx.arc(240,295,48,0,Math.PI*2);ctx.fill();
      }else{
        ctx.fillStyle=INK;ctx.beginPath();ctx.roundRect(123,180,234,220,57);ctx.fill();ctx.fillStyle='#eac68a';ctx.beginPath();ctx.roundRect(139,198,202,180,43);ctx.fill();
        ctx.fillStyle=INK;for(const ex of [200,280]){ctx.beginPath();ctx.ellipse(ex,270,25,39,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#eac68a';ctx.beginPath();ctx.moveTo(ex,270);ctx.lineTo(ex+30,248);ctx.lineTo(ex+28,270);ctx.fill();ctx.fillStyle=INK;}
        ctx.fillRect(188,330,102,8);ctx.fillRect(229,143,20,40);ctx.beginPath();ctx.arc(239,132,23,0,Math.PI*2);ctx.fill();
      }
      ctx.font='900 47px Impact, sans-serif';const lines=sub.split('|');lines.forEach((t,i)=>ctx.fillText(t,w/2,475+i*55,w-65));
      ctx.font='19px monospace';ctx.fillText('MINISTRY APPROVED / 1965',w/2,610,w-70);
      for(let i=0;i<120;i++){ctx.fillStyle=rand()<.5?'rgba(30,25,38,.06)':'rgba(255,239,206,.16)';ctx.fillRect(rand()*w,rand()*h,random(1,4),random(1,3));}
    });
    planeTexture(tex,2.1,2.9,staticRoot,[x,y,z],[0,angle,-.045]);
  }
  poster('SMILE!',"IT'S FOR YOUR|OWN GOOD.",-18.52,2.2,-3,Math.PI/2);
  poster('ENLIST!',"NO HEART.|NO PROBLEM.",18.92,2.1,-.5,-Math.PI/2,'robot');
  poster('BE USEFUL.',"THINK LESS.|PRODUCE MORE.",-18.55,2.2,8,Math.PI/2,'robot');
  poster('WE SEE YOU.',"THE TRUTH|IS IN GOOD HANDS.",18.5,2.2,-16,-Math.PI/2);
  // Small original printed handbills on the street.
  const handbill=canvas(128,128,(ctx,w,h)=>{ctx.fillStyle='#d7c49b';ctx.fillRect(0,0,w,h);ctx.fillStyle=INK;ctx.font='900 26px Impact, sans-serif';ctx.fillText('WAR!',12,36);ctx.fillRect(12,45,104,5);for(let j=0;j<6;j++)ctx.fillRect(12,57+j*10,80+rand()*22,3);});
  for(let i=0;i<9;i++)planeTexture(handbill,.45,.58,staticRoot,[random(-13,13),.045,random(-19,20)],[-Math.PI/2,0,random(-2,2)],{side:THREE.DoubleSide});

  // Ground-level boundary barricade keeps the prototype contained without an invisible street exit.
  for(const z of [-23.2,23.6])for(const x of [-10,-4,4,10]){
    box(4.7,.88,.3,'#4b414a',staticRoot,[x,.8,z]);planeTexture(stripeTex,4.6,.64,staticRoot,[x,.8,z+(z>0?-.17:.17)],[0,z>0?Math.PI:0,0]);
    for(const xx of [-1.8,1.8])box(.24,1.65,.24,'#453a43',staticRoot,[x+xx,.72,z]);
    addCollider(x,z,4.8,.5,1.3);
  }
  // Keep spawn entrances open between and behind barricades; collision bounds remain readable.
  sign('DISTRICT 06 / NO EXIT',7.1,.9,staticRoot,[0,3.8,25.2],{bg:INK,fg:'#ffce75'}).rotation.y=Math.PI;
  tube([[-4,0,25.3],[-4,3.9,25.3],[4,3.9,25.3],[4,0,25.3]],.10,INK);

  // Rain is fine enough to read as atmosphere without obscuring targets.
  const rainGeo=new THREE.BufferGeometry(),rainPos=new Float32Array(rainCount*6),rainVel=new Float32Array(rainCount);
  for(let i=0;i<rainCount;i++){
    const x=random(-27,27),y=random(1,22),z=random(-31,31);rainPos.set([x,y,z,x-.055,y+.45,z],i*6);rainVel[i]=random(9,14);
  }
  rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
  const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:'#ffe2c2',transparent:true,opacity:.19,depthWrite:false}));animated.add(rain);

  // Static geometry is merged by material. Detail stays cheap on phones.
  staticRoot.updateMatrixWorld(true);
  const batches=new Map(),keep=[];
  staticRoot.traverse(o=>{
    if(!o.isMesh || o===sky)return;
    if(Array.isArray(o.material)) {keep.push(o);return;}
    const key=o.material.uuid;
    if(!batches.has(key))batches.set(key,{material:o.material,geometries:[],ink:o.userData.ink||false,cast:o.castShadow,receive:o.receiveShadow,renderOrder:o.renderOrder});
    const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);batches.get(key).geometries.push(geo);
  });
  scene.remove(staticRoot);
  const mergedRoot=new THREE.Group();scene.add(mergedRoot);
  for(const b of batches.values()) {
    let count=0;for(const g of b.geometries)count+=g.attributes.position.count;
    const pos=new Float32Array(count*3),normal=new Float32Array(count*3),uv=new Float32Array(count*2);let vertexOffset=0;
    for(const g of b.geometries){const n=g.attributes.position.count;pos.set(g.attributes.position.array,vertexOffset*3);if(g.attributes.normal)normal.set(g.attributes.normal.array,vertexOffset*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,vertexOffset*2);vertexOffset+=n;g.dispose();}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(normal,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,b.material);mesh.castShadow=b.cast&&!b.ink;mesh.receiveShadow=b.receive;mesh.renderOrder=b.renderOrder||0;mergedRoot.add(mesh);
  }
  // Original construction geometries are no longer drawn and can be reclaimed.
  staticRoot.traverse(o=>{if(o.isMesh)o.geometry.dispose();});

  const bounds={minX:-17.5,maxX:17.5,minZ:-23,maxZ:23};
  const spawnPoints=[[-14,-19],[0,-21],[11,-17],[-12,-9],[13,0],[-15.4,18.5],[4,21],[15.4,18.5]].map(([x,z])=>new THREE.Vector3(x,0,z));
  return {
    colliders, spawnPoints, bounds, start:new THREE.Vector3(0,1.7,15.5), startYaw:0,
    update(dt,time,playerPos) {
      for(const s of smoke){s.mesh.position.x=s.x+Math.sin(time*.22+s.phase)*.45;s.mesh.position.y=s.y+Math.sin(time*.35+s.phase)*.35;}
      for(const f of fans)f.rotation.y=Math.sin(time*.26)*.65;
      for(let i=0;i<rainCount;i++){
        const j=i*6;rainPos[j]-=dt*.55;rainPos[j+1]-=dt*rainVel[i];rainPos[j+3]=rainPos[j]-.055;rainPos[j+4]=rainPos[j+1]+.45;
        if(rainPos[j+1]<.1){rainPos[j+1]=22;rainPos[j+4]=22.45;rainPos[j]=random(-27,27);rainPos[j+3]=rainPos[j]-.055;}
      }
      rainGeo.attributes.position.needsUpdate=true;
    }
  };
}
