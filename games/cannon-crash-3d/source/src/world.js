import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {THEMES} from './levels.js';

export const PLATFORM={x:0,z:-5.1,y:2.15,width:8.3,depth:5.1};
const shared={};
export const TARGET_PHYSICS_MATERIAL=new CANNON.Material('targets');
export const PLATFORM_PHYSICS_MATERIAL=new CANNON.Material('platform');
const registeredWorlds=new WeakSet();
const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.08,...extra});
const box=(w,h,d,mat)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
const cyl=(r1,r2,h,mat,sides=16)=>new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,sides),mat);
const sphere=(r,mat,sides=14)=>new THREE.Mesh(new THREE.SphereGeometry(r,sides,10),mat);
const make=(parent,mesh,x=0,y=0,z=0)=>{mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
const mulberry=(seed)=>()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};

function addStar(group,color,z=.45,scale=.25){
  const shape=new THREE.Shape();const n=5;
  for(let i=0;i<n*2;i++){const a=i*Math.PI/n-Math.PI/2,r=i%2?scale*.43:scale;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?shape.lineTo(px,py):shape.moveTo(px,py);}shape.closePath();
  make(group,new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide})),0,0,z);
}

function buildTargetMesh(type,index){
  const g=new THREE.Group(); const gray=material('#263c55',{metalness:.25});
  if(type==='barrel'){
    const wood=material(index%3===0?'#bc7147':'#a85c38');
    make(g,cyl(.42,.44,.92,wood,14));
    [-.34,.34].forEach(y=>make(g,cyl(.446,.446,.09,material('#63515b',{metalness:.47})),0,y,0));
    for(let i=0;i<8;i++){let a=i*Math.PI/4;const stave=box(.045,.75,.06,material('#d49261'));stave.position.set(Math.sin(a)*.427,0,Math.cos(a)*.427);stave.rotation.y=a;g.add(stave);}
    const badge=cyl(.2,.2,.025,material('#f5d17c'),20);badge.rotation.x=Math.PI/2;make(g,badge,0,0,.447);addStar(g,'#8d5236',.47,.14);
    return {mesh:g,height:.92,radius:.44,shape:new CANNON.Cylinder(.43,.43,.92,12),mass:1.3};
  }
  if(type==='can'){
    const body=material(index%2?'#68bcc0':'#ec865b',{metalness:.28,roughness:.48});
    make(g,cyl(.35,.35,.82,body,20));
    [-.39,.39].forEach(y=>make(g,cyl(.356,.356,.045,material('#dfe9e6',{metalness:.65})),0,y,0));
    const ring=cyl(.23,.23,.015,material('#f7e6ab'));ring.rotation.x=Math.PI/2;make(g,ring,0,0,.348);addStar(g,index%2?'#315f70':'#b94e47',.37,.16);
    return {mesh:g,height:.82,radius:.35,shape:new CANNON.Cylinder(.35,.35,.82,14),mass:.74};
  }
  if(type==='crate'){
    make(g,box(.82,.82,.82,material(index%2?'#dba063':'#bc824f')));
    const beamMat=material('#8e573a');
    for(const y of [-.32,.32])for(const z of [-.422,.422])make(g,box(.82,.105,.055,beamMat),0,y,z);
    for(const x of [-.34,.34])for(const z of [-.422,.422])make(g,box(.095,.82,.052,beamMat),x,0,z);
    const diagonal=make(g,box(.08,.93,.07,beamMat),0,0,.447);diagonal.rotation.z=Math.PI/4;
    addStar(g,'#f5ca79',.485,.14);
    return {mesh:g,height:.82,radius:.41,shape:new CANNON.Box(new CANNON.Vec3(.41,.41,.41)),mass:1.06};
  }
  if(type==='neon'){
    const hue=['#fe57b7','#5eeff4','#9c7cff','#ffd56d'][index%4];
    make(g,box(.83,.83,.83,material('#293557',{metalness:.2,roughness:.28})));
    const glass=material(hue,{emissive:hue,emissiveIntensity:.35,roughness:.24,metalness:.18});
    for(const y of [-.411,.411])for(const z of [-.411,.411])make(g,box(.85,.055,.055,glass),0,y,z);
    for(const x of [-.412,.412])for(const z of [-.412,.412])make(g,box(.055,.85,.055,glass),x,0,z);
    for(const x of [-.412,.412])for(const y of [-.412,.412])make(g,box(.055,.055,.85,glass),x,y,0);
    const face=make(g,box(.49,.49,.019,material(hue,{emissive:hue,emissiveIntensity:.3,metalness:.15})),0,0,.427);face.rotation.z=Math.PI/4;
    return {mesh:g,height:.83,radius:.42,shape:new CANNON.Box(new CANNON.Vec3(.415,.415,.415)),mass:1.02};
  }
  const ice=material(index%3===0?'#91f4ff':'#b6f4fb',{metalness:.05,roughness:.26,transparent:true,opacity:.89});
  make(g,box(.82,.82,.82,ice));
  const edge=material('#e8ffff',{emissive:'#5ac6ee',emissiveIntensity:.2,roughness:.24});
  for(const x of [-.4,.4])for(const y of [-.4,.4])make(g,box(.045,.045,.85,edge),x,y,0);
  for(const z of [-.4,.4])for(const y of [-.4,.4])make(g,box(.85,.045,.045,edge),0,y,z);
  const facet=make(g,box(.46,.45,.023,material('#e8ffff',{transparent:true,opacity:.4})),0,.02,.427);facet.rotation.z=.36;
  return {mesh:g,height:.82,radius:.41,shape:new CANNON.Box(new CANNON.Vec3(.41,.41,.41)),mass:1.04};
}

function makePlatform(group,physics,theme){
  const p=PLATFORM;let colors=theme===0?['#9c6448','#f2c184','#5d4e4b']:theme===1?['#27375e','#1dc7d5','#343664']:['#83c7dc','#e4faff','#427fa8'];
  const platform=box(p.width,.57,p.depth,material(colors[0],{metalness:theme===1?.35:.1}));make(group,platform,p.x,p.y-.285,p.z);
  const top=box(p.width+.08,.085,p.depth+.08,material(colors[1],{roughness:theme===1?.33:.8}));make(group,top,p.x,p.y-.015,p.z);
  const rim=material(colors[2],{metalness:.3});
  make(group,box(p.width+.18,.13,.12,rim),0,p.y-.14,p.z+p.depth/2);
  make(group,box(p.width+.18,.13,.12,rim),0,p.y-.14,p.z-p.depth/2);
  for(const x of [-p.width/2,p.width/2])make(group,box(.13,.13,p.depth+.1,rim),x,p.y-.14,p.z);
  for(const x of [-3,3])for(const z of [p.z-1.9,p.z+1.9]){
    make(group,cyl(.33,.45,4.7,material(colors[2])),x,-.48,z);
    make(group,cyl(.53,.53,.2,material(colors[0])),x,-2.45,z);
  }
  if(theme===0){
    for(let x=-3.5;x<=3.5;x+=.64)make(group,box(.035,.014,p.depth-.28,material('#e9b17c',{transparent:true,opacity:.34})),x,p.y+.029,p.z);
  }else if(theme===1){
    for(let x=-3.5;x<=3.5;x+=.8)make(group,box(.018,.012,p.depth,material('#7deef4',{emissive:'#16d5ed',emissiveIntensity:.85})),x,p.y+.033,p.z);
  }else{
    for(let i=0;i<18;i++){const crack=box(.03,.01,.55,material('#eafaff',{transparent:true,opacity:.35}));make(group,crack,(i%9-4)*.84,p.y+.03,p.z+Math.floor(i/9)*1.45-.65);crack.rotation.y=(i%3-1)*.45;}
  }
  // Back railing is decorative; the sides remain open so objects can tumble off.
  const railMat=material(theme===1?'#4be7e4':theme===2?'#eefaff':'#725441',{metalness:.35});
  for(const x of [-3.95,-2.65,-1.3,0,1.3,2.65,3.95])make(group,box(.1,.68,.11,railMat),x,p.y+.34,p.z-p.depth/2);
  make(group,box(p.width,.095,.12,railMat),0,p.y+.7,p.z-p.depth/2);
  const body=new CANNON.Body({mass:0,material:PLATFORM_PHYSICS_MATERIAL});
  body.addShape(new CANNON.Box(new CANNON.Vec3(p.width/2,.285,p.depth/2)));
  body.position.set(0,p.y-.285,p.z);physics.addBody(body);
  return body;
}

// Smaller, elevated decks add the stacked silhouette from the reference game.
// Each deck is an independent static collider: a target can fall off its own
// shelf even when a lower deck happens to catch it.
function makeElevatedShelf(group,physics,theme,p){
  const deck=theme===0?'#ac7653':theme===1?'#334169':'#8ccde2';
  const trim=theme===0?'#f5bd7c':theme===1?'#55f8f2':'#e5ffff';
  const apron=theme===0?['#39736e','#fff2cf']:theme===1?['#292856','#e956c4']:['#549fcb','#f0fbff'];
  make(group,box(p.width,.38,p.depth,material(deck,{metalness:theme===1?.28:.08})),p.x,p.y-.19,p.z);
  make(group,box(p.width+.12,.095,p.depth+.12,material(trim,{roughness:theme===1?.32:.65})),p.x,p.y+.018,p.z);
  const frontZ=p.z+p.depth/2+.04;
  make(group,box(p.width+.2,.6,.17,material('#4d4a56',{metalness:.16})),p.x,p.y-.57,frontZ);
  const panelWidth=p.width/Math.ceil(p.width/.52);
  for(let i=0,n=Math.ceil(p.width/.52);i<n;i++){
    const x=p.x-p.width/2+(i+.5)*panelWidth;
    make(group,box(panelWidth-.036,.42,.044,material(apron[i%2])),x,p.y-.55,frontZ+.107);
    if(theme===1)make(group,box(panelWidth-.042,.045,.05,material(trim,{emissive:trim,emissiveIntensity:1.1})),x,p.y-.28,frontZ+.11);
  }
  make(group,box(p.width+.23,.13,.24,material(trim,{metalness:.23})),p.x,p.y-.24,frontZ);
  for(let i=0;i<Math.floor(p.width/.72);i++){
    const x=p.x-p.width/2+.43+i*.72;
    const bolt=sphere(.052,material(theme===1?'#b9f5ff':'#f7e7cd',{metalness:.45}),8);
    make(group,bolt,x,p.y-.19,frontZ+.17);
  }
  // Structural stilts keep floating shelves visually grounded in all worlds.
  for(const side of [-1,1]){
    const x=p.x+side*(p.width/2-.35),height=p.y+6.6;
    make(group,box(.2,height,.23,material(theme===0?'#795344':theme===1?'#39517c':'#72adc8')),
      x,p.y-height/2-.34,p.z-.23);
    make(group,box(.35,.2,.42,material(trim)),x,p.y-.48,p.z-.23);
  }
  const rail=material(theme===0?'#8c5541':theme===1?'#5ae9f5':'#c7f4ff',{metalness:.25});
  for(const x of [p.x-p.width/2+.12,p.x,p.x+p.width/2-.12]){
    make(group,box(.095,.45,.1,rail),x,p.y+.3,p.z-p.depth/2);
  }
  make(group,box(p.width,.075,.1,rail),p.x,p.y+.55,p.z-p.depth/2);
  const body=new CANNON.Body({mass:0,material:PLATFORM_PHYSICS_MATERIAL});
  body.addShape(new CANNON.Box(new CANNON.Vec3(p.width/2,.19,p.depth/2)));
  body.position.set(p.x,p.y-.19,p.z);physics.addBody(body);
  return body;
}

// A moving arcade obstacle. Kinematic Cannon bodies transfer their velocity to
// incoming balls; they are not decorative or scripted target knockdowns.
function makeChevronBumper(group,physics,theme,cfg,shelf){
  const width=1.15,height=.69,depth=.33;
  const mesh=new THREE.Group();group.add(mesh);
  const color=theme===1?'#fa42bb':theme===2?'#ee5275':'#ed4d30';
  make(mesh,box(width+.15,height+.14,depth+.12,material('#312c41',{metalness:.32})),0,0,0);
  make(mesh,box(width,height,.055,material(color,{emissive:color,emissiveIntensity:theme===1?.65:.14})),0,0,depth/2+.065);
  const arrowMaterial=new THREE.MeshBasicMaterial({color:'#fff7d6',side:THREE.DoubleSide});
  for(let k=0;k<2;k++){
    const dx=(k-.5)*.4;
    const shape=new THREE.Shape();
    shape.moveTo(dx-.16,-.25);shape.lineTo(dx+.13,0);shape.lineTo(dx-.16,.25);
    shape.lineTo(dx-.035,.25);shape.lineTo(dx+.25,0);shape.lineTo(dx-.035,-.25);
    shape.closePath();make(mesh,new THREE.Mesh(new THREE.ShapeGeometry(shape),arrowMaterial),0,0,depth/2+.102);
  }
  const body=new CANNON.Body({mass:0,type:CANNON.Body.KINEMATIC,material:PLATFORM_PHYSICS_MATERIAL});
  body.addShape(new CANNON.Box(new CANNON.Vec3(width/2,height/2,depth/2)));
  const center=shelf.x+(cfg.x||0),z=shelf.z+cfg.z,y=shelf.y+height/2+.075;
  body.position.set(center+Math.sin(cfg.phase||0)*cfg.range,y,z);physics.addBody(body);
  mesh.position.copy(body.position);
  return {body,mesh,center,range:cfg.range,speed:cfg.speed,phase:cfg.phase||0};
}

function populateDesert(g,rng){
  const sand=material('#b86e51',{roughness:1});make(g,box(230,.5,230,sand),0,-8,-36);
  const dune=material('#d78d66');for(let i=0;i<24;i++){
    const x=(rng()-.5)*95,z=-13-rng()*58,scale=3+rng()*9;
    const d=sphere(1,dune,12);d.scale.set(scale,.6+rng()*.65,scale*.66);make(g,d,x,-7.4,z);
  }
  const mesaMats=[material('#ac5e50'),material('#be7157'),material('#8b5560')];
  for(let i=0;i<22;i++){
    const x=(rng()-.5)*105,z=-20-rng()*68,h=4+rng()*13;
    const rock=cyl(1.5+rng()*2.5,2.8+rng()*3,h,mesaMats[i%3],6);make(g,rock,x,-7.6+h/2,z);
    make(g,cyl(2.9,3.2,.5,mesaMats[i%3],6),x,-7.6+h,z);
  }
  const cactus=material('#3e8976');for(let i=0;i<14;i++){
    const x=(rng()-.5)*38,z=-8-rng()*35,h=1.2+rng()*2;
    if(Math.abs(x)<5&&z>-13)continue;
    make(g,cyl(.14,.22,h,cactus,8),x,-6.8+h/2,z);
    for(let j of [-1,1]){const arm=make(g,cyl(.1,.12,.65,cactus,7),x+j*.35,-6.8+h*.52,z);arm.rotation.z=j*-.95;make(g,cyl(.085,.1,.56,cactus,7),x+j*.65,-6.8+h*.7,z);}
  }
  const sun=material('#ffe2a7',{emissive:'#ffd19c',emissiveIntensity:1.2,roughness:1});make(g,sphere(6,sun,24),21,22,-84);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(7.8,24,12),new THREE.MeshBasicMaterial({color:'#ffcf91',transparent:true,opacity:.08,depthWrite:false}));make(g,halo,21,22,-84);
}

function populateNeon(g,rng){
  make(g,box(240,.4,240,material('#111b3b',{metalness:.25})),0,-8,-36);
  const gridmat=new THREE.LineBasicMaterial({color:'#286a8d',transparent:true,opacity:.35});
  const points=[];for(let i=-90;i<=90;i+=5){points.push(new THREE.Vector3(i,-7.75,-115),new THREE.Vector3(i,-7.75,55));points.push(new THREE.Vector3(-110,-7.75,i-36),new THREE.Vector3(110,-7.75,i-36));}
  make(g,new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),gridmat));
  for(let i=0;i<130;i++){
    const x=(rng()-.5)*130,z=-12-rng()*95;
    if(Math.abs(x)<7&&z>-25)continue;
    const h=3+rng()*28,w=1+rng()*4;
    const col=i%3===0?'#fc5ac2':i%3===1?'#4cfafa':'#9672f9';
    make(g,box(w,h,w,material('#20274b',{metalness:.3})),x,-7.6+h/2,z);
    for(let j=0;j<Math.min(6,Math.floor(h/3));j++)make(g,box(w+.025,.09,.05,material(col,{emissive:col,emissiveIntensity:1.3})),x,-7.6+h*.17+j*2.9,z+w/2+.04);
    if(i%3===0)make(g,box(w+.08,.18,w+.08,material(col,{emissive:col,emissiveIntensity:1.8})),x,-7.6+h+.08,z);
  }
  const moon=material('#f4a6fb',{emissive:'#cc75ff',emissiveIntensity:1.3});make(g,sphere(5,moon,24),-29,25,-85);
  for(let side of [-1,1]){const neon=material(side===1?'#fb67c8':'#35e5eb',{emissive:side===1?'#fb67c8':'#35e5eb',emissiveIntensity:1.3});for(let i=0;i<5;i++){
    const z=-3-i*4;make(g,box(.18,4.8,.18,neon),side*(5+i*.15),-.1,z);make(g,box(.36,.17,.36,neon),side*(5+i*.15),2.4,z);
  }}
}

function populateIce(g,rng){
  make(g,box(250,.4,250,material('#d3f1fb')),0,-8,-35);
  const snowmat=[material('#c2e4f3'),material('#f1ffff'),material('#8fbedb')];
  for(let i=0;i<34;i++){
    const x=(rng()-.5)*130,z=-18-rng()*65,rad=2+rng()*6,height=5+rng()*22;
    const peak=new THREE.Mesh(new THREE.ConeGeometry(rad,height,5),snowmat[i%3]);make(g,peak,x,-7.5+height/2,z);
    if(i%2===0){const cap=new THREE.Mesh(new THREE.ConeGeometry(rad*.45,height*.34,5),snowmat[1]);make(g,cap,x,-7.5+height*.83,z);}
  }
  const stone=material('#79adc5');const trim=material('#e2fcff');
  for(let side of [-1,1]){
    let x=side*19;make(g,box(9,12,5,stone),x,-2,-42);
    for(let dx of [-3.4,3.4]){
      make(g,cyl(2.1,2.1,16,stone,8),x+dx,0,-39);
      make(g,new THREE.Mesh(new THREE.ConeGeometry(2.6,5,8),trim),x+dx,10,-39);
    }
    for(let j=0;j<4;j++)make(g,box(.9,1.7,.1,material('#317b9b',{emissive:'#78dffa',emissiveIntensity:.4})),x+(j-1.5)*1.8,-.1,-39.4);
  }
  const moon=material('#e8feff',{emissive:'#b0eafa',emissiveIntensity:.9});make(g,sphere(5,moon,24),24,26,-81);
  const verts=[];for(let i=0;i<220;i++)verts.push((rng()-.5)*65,rng()*34-6,-rng()*80+10);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  const snow=new THREE.Points(geo,new THREE.PointsMaterial({color:'#ffffff',size:.18,transparent:true,opacity:.85,depthWrite:false}));g.add(snow);shared.snow=snow;
}

export function createStage(scene,physics,level,index,impact){
  const themeIndex=level.theme;const theme=THEMES[themeIndex],rng=mulberry(index*91837+72);
  const group=new THREE.Group();scene.add(group);
  const sky=new THREE.Color(theme.sky);
  scene.background=sky;scene.fog=new THREE.FogExp2(sky,themeIndex===1?.009:.008);
  if(themeIndex===0)populateDesert(group,rng);
  if(themeIndex===1)populateNeon(group,rng);
  if(themeIndex===2)populateIce(group,rng);
  const platforms=[PLATFORM,...(level.shelves||[])];
  const platformBodies=[makePlatform(group,physics,themeIndex)];
  for(const shelf of platforms.slice(1))platformBodies.push(makeElevatedShelf(group,physics,themeIndex,shelf));
  const hazards=(level.hazards||[]).map(cfg=>makeChevronBumper(group,physics,themeIndex,cfg,platforms[cfg.shelf||0]));
  const targets=[];
  if(!registeredWorlds.has(physics)){
    physics.addContactMaterial(new CANNON.ContactMaterial(TARGET_PHYSICS_MATERIAL,PLATFORM_PHYSICS_MATERIAL,{friction:.11,restitution:.17}));
    registeredWorlds.add(physics);
  }
  // Tower levels need bodies to settle before play; overlap is deliberately avoided.
  level.targets.forEach((it,i)=>{
    const look=buildTargetMesh(it.type,i);
    const h=look.height;
    const shelf=platforms[it.shelf||0];
    // Exact stacking heights keep cans, barrels and crates resting on each other.
    const y=shelf.y+h*.5+(it.tier||0)*h;
    const x=shelf.x+it.x+(it.tier?0:(rng()-.5)*.045);
    const z=shelf.z+it.z+(it.tier?0:(rng()-.5)*.045);
    look.mesh.position.set(x,y,z);group.add(look.mesh);
    const body=new CANNON.Body({mass:look.mass,shape:look.shape,material:TARGET_PHYSICS_MATERIAL,linearDamping:.045,angularDamping:.10,allowSleep:true,sleepTimeLimit:.75,sleepSpeedLimit:.11});
    body.position.set(x,y,z);body.quaternion.setFromEuler(0,it.angle||0,0);physics.addBody(body);
    const target={body,mesh:look.mesh,type:it.type,shelf,removed:false,lastImpact:-100,initialPosition:new THREE.Vector3(x,y,z)};
    body.addEventListener('collide',(e)=>{
      if(!target.removed && (e.body.isProjectile||e.body.isTarget)){
        const now=performance.now()/1000;
        if(now-target.lastImpact>.22){target.lastImpact=now;impact(target,body.position,e.body);}
      }
    });
    body.isTarget=true;targets.push(target);
  });
  let snowTime=0,hazardTime=0;
  const snow=themeIndex===2?shared.snow:null;
  function beforeStep(dt){
    hazardTime+=dt;
    for(const hazard of hazards){
      const desired=hazard.center+Math.sin(hazardTime*hazard.speed+hazard.phase)*hazard.range;
      hazard.body.velocity.set((desired-hazard.body.position.x)/Math.max(.001,dt),0,0);
    }
  }
  function update(dt){
    for(const hazard of hazards)hazard.mesh.position.copy(hazard.body.position);
    if(snow){snowTime+=dt;const arr=snow.geometry.attributes.position;
      for(let i=0;i<arr.count;i++){
        let y=arr.getY(i)-dt*(1.6+(i%5)*.3);if(y<-7)y=27;
        arr.setY(i,y);arr.setX(i,arr.getX(i)+dt*.18);
      }arr.needsUpdate=true;
    }
  }
  function dispose(){
    targets.forEach(t=>physics.removeBody(t.body));
    for(const hazard of hazards)physics.removeBody(hazard.body);
    for(const body of platformBodies)physics.removeBody(body);
    scene.remove(group);group.traverse(o=>{o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
    if(snow===shared.snow)shared.snow=null;
  }
  return {group,targets,platforms,platformBodies,hazards,platformBody:platformBodies[0],beforeStep,update,dispose,theme};
}

export function buildCannon(scene){
  const root=new THREE.Group();root.position.set(0,0,8.1);scene.add(root);
  const dock=box(5.6,.5,4.4,material('#4f5e7e'));make(root,dock,0,-.42,.15);
  for(let x=-2.35;x<=2.35;x+=.59)make(root,box(.06,.035,4.3,material('#78859b')),x,-.14,.15);
  const metal=material('#4c658e',{metalness:.55,roughness:.34});
  const dark=material('#24395f',{metalness:.52,roughness:.34});
  const rim=material('#8eb0cb',{metalness:.65,roughness:.23});
  const carriage=new THREE.Group();root.add(carriage);
  make(carriage,box(1.6,.4,1.65,dark),0,.16,0);
  for(const x of [-.87,.87]){
    const wheel=cyl(.73,.73,.27,metal,20);wheel.rotation.z=Math.PI/2;make(carriage,wheel,x,.2,.45);
    const hub=cyl(.27,.27,.29,rim);hub.rotation.z=Math.PI/2;make(carriage,hub,x*1.01,.2,.45);
    for(let j=0;j<8;j++){const a=j*Math.PI/4;const spoke=box(.07,.6,.09,rim);spoke.position.set(x*1.04,.2+Math.sin(a)*.3,.45+Math.cos(a)*.3);spoke.rotation.x=a;carriage.add(spoke);}
  }
  const turret=new THREE.Group();turret.position.y=.87;root.add(turret);
  make(turret,cyl(.68,.77,.3,metal,20),0,-.15,0);
  const pitch=new THREE.Group();turret.add(pitch);
  const barrel=cyl(.45,.63,2.6,metal,24);barrel.rotation.x=Math.PI/2;make(pitch,barrel,0,0,-1.0);
  const muzzle=cyl(.58,.53,.34,dark,24);muzzle.rotation.x=Math.PI/2;make(pitch,muzzle,0,0,-2.28);
  const ring=cyl(.56,.56,.09,rim,24);ring.rotation.x=Math.PI/2;make(pitch,ring,0,0,-2.48);
  const hole=cyl(.3,.3,.012,material('#0b182c',{metalness:.2}),24);hole.rotation.x=Math.PI/2;make(pitch,hole,0,0,-2.537);
  const band=cyl(.66,.66,.18,rim,24);band.rotation.x=Math.PI/2;make(pitch,band,0,0,-.43);
  const pin=cyl(.37,.37,.52,dark,20);pin.rotation.z=Math.PI/2;make(turret,pin,0,0,.15);
  const muzzlePoint=new THREE.Object3D();muzzlePoint.position.set(0,0,-2.66);pitch.add(muzzlePoint);
  const burstFlash=new THREE.Mesh(new THREE.SphereGeometry(.58,10,8),new THREE.MeshBasicMaterial({color:'#fffab0',transparent:true,opacity:0,depthWrite:false}));make(pitch,burstFlash,0,0,-2.7);
  const pointLight=new THREE.PointLight('#ffc47b',0,5);make(pitch,pointLight,0,0,-2.5);
  function aim(yaw,elevation){turret.rotation.y=yaw;pitch.rotation.x=elevation;}
  function flash(power){burstFlash.material.opacity=power*.8;burstFlash.scale.setScalar(1+power*.3);pointLight.intensity=power*3;}
  function tick(dt){burstFlash.material.opacity=Math.max(0,burstFlash.material.opacity-dt*4);pointLight.intensity=Math.max(0,pointLight.intensity-dt*12);}
  return {root,turret,pitch,muzzlePoint,aim,flash,tick};
}
