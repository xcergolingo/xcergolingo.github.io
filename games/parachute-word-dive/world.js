import * as THREE from './vendor/three.module.js';

const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const colors=['#8e9d9a','#a6a59e','#b9b7a7','#778d91','#899da8','#aca69a','#d0bca8','#667c84','#bac7bd','#9e9b91'];

function random(seed){return function(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

function cityTexture(){
  const c=document.createElement('canvas');c.width=c.height=2048;
  const ctx=c.getContext('2d');const rng=random(27031976);
  ctx.fillStyle='#7c9282';ctx.fillRect(0,0,2048,2048);
  for(let i=0;i<240;i++){
    const x=rng()*2048,y=rng()*2048,w=35+rng()*165,h=20+rng()*120;
    ctx.fillStyle=['#71907b','#6f896c','#87977d','#9ba087','#889586','#687c72'][Math.floor(rng()*6)];
    ctx.fillRect(x,y,w,h);
  }
  const unit=61;
  for(let gy=0;gy<2048;gy+=unit){
    for(let gx=0;gx<2048;gx+=unit){
      const v=rng();
      ctx.fillStyle=v<.16?'#688876':v<.24?'#99a195':['#a0a6a2','#c2c1b6','#9badaf','#c0b2a8','#868e8c','#b6afa5'][Math.floor(rng()*6)];
      ctx.fillRect(gx+6,gy+7,unit-13,unit-14);
      for(let k=0;k<3;k++){
        const rx=gx+8+rng()*(unit-32),ry=gy+9+rng()*(unit-31);
        ctx.fillStyle=rng()<.5?'#667d81':'#d0c4b0';ctx.fillRect(rx,ry,8+rng()*14,7+rng()*10);
      }
    }
  }
  for(let x=0;x<2048;x+=unit){
    ctx.fillStyle='#626e70';ctx.fillRect(x,0,9,2048);
    ctx.fillStyle='#b3af9d';ctx.fillRect(x+1,0,1.5,2048);
    ctx.strokeStyle='#c9c7ba7d';ctx.lineWidth=1;ctx.setLineDash([6,10]);ctx.beginPath();ctx.moveTo(x+4.5,0);ctx.lineTo(x+4.5,2048);ctx.stroke();
  }
  for(let y=0;y<2048;y+=unit){
    ctx.fillStyle='#626e70';ctx.fillRect(0,y,2048,9);
    ctx.fillStyle='#b3af9d';ctx.fillRect(0,y+1,2048,1.5);
    ctx.strokeStyle='#c9c7ba7d';ctx.lineWidth=1;ctx.setLineDash([6,11]);ctx.beginPath();ctx.moveTo(0,y+4.5);ctx.lineTo(2048,y+4.5);ctx.stroke();
  }
  ctx.setLineDash([]);
  // Broad green parks, waterways, an airport district and a freeway interchange.
  ctx.fillStyle='#50858d';ctx.beginPath();ctx.moveTo(0,390);ctx.bezierCurveTo(400,270,570,490,940,440);ctx.bezierCurveTo(1260,410,1550,230,2048,380);ctx.lineTo(2048,435);ctx.bezierCurveTo(1550,300,1260,470,950,495);ctx.bezierCurveTo(570,555,410,350,0,448);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#dfd7bf';ctx.lineWidth=15;ctx.beginPath();ctx.moveTo(-100,1450);ctx.bezierCurveTo(430,1320,580,1030,1060,880);ctx.bezierCurveTo(1550,730,1590,730,2200,560);ctx.stroke();
  ctx.strokeStyle='#657373';ctx.lineWidth=11;ctx.stroke();
  ctx.fillStyle='#587d65';ctx.beginPath();ctx.ellipse(1250,1170,180,120,-.28,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#73856d';ctx.beginPath();ctx.ellipse(590,1320,150,100,.2,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#60696b';ctx.fillRect(1550,140,355,205);
  ctx.fillStyle='#c9c2aa';ctx.fillRect(1575,237,308,8);
  ctx.setLineDash([35,34]);ctx.strokeStyle='#e6e1cc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(1585,240);ctx.lineTo(1875,240);ctx.stroke();ctx.setLineDash([]);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}

function cloudTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  const spots=[[.35,.54,.26],[.53,.4,.28],[.66,.53,.26],[.46,.59,.29]];
  for(const [x,y,r] of spots){const g=ctx.createRadialGradient(x*256,y*256,5,x*256,y*256,r*256);g.addColorStop(0,'rgba(255,255,255,.44)');g.addColorStop(.55,'rgba(255,255,255,.27)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}
  return new THREE.CanvasTexture(c);
}

function wordTexture(text){
  const c=document.createElement('canvas');c.width=512;c.height=174;const ctx=c.getContext('2d');
  ctx.shadowColor='#00ffe699';ctx.shadowBlur=23;ctx.fillStyle='rgba(8,55,69,.85)';roundedRect(ctx,19,26,474,118,25);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#b8fff2cc';ctx.lineWidth=4;roundedRect(ctx,19,26,474,118,25);ctx.stroke();
  ctx.fillStyle='#c6ffdc';ctx.beginPath();ctx.arc(49,85,8,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f5fffb';ctx.textAlign='center';ctx.textBaseline='middle';
  const len=[...String(text)].length;let px=len>21?30:len>15?35:len>10?41:len>7?48:57;
  ctx.font=`900 ${px}px -apple-system,system-ui,Arial,sans-serif`;ctx.fillText(String(text),274,86,388);
  ctx.fillStyle='#a4f8d8';ctx.fillRect(70,136,372,3);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function createTextSprite(message,w=75,h=26){
  const map=wordTexture(message),material=new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,depthTest:false});
  const sprite=new THREE.Sprite(material);sprite.scale.set(w,h,1);return sprite;
}

function ball(radius,color,parent,x,y,z,segments=13){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,segments,10),new THREE.MeshStandardMaterial({color,roughness:.8}));
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}
function cylinder(r1,r2,height,color,parent,x,y,z,segments=10){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,height,segments),new THREE.MeshStandardMaterial({color,roughness:.75}));
  mesh.position.set(x,y,z);parent.add(mesh);return mesh;
}

export class SkyWorld{
  constructor(container){
    this.container=container;this.cameraMode='chase';this.worldTime=0;this.ringGroups=[];this.particles=[];this.clouds=[];
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#8faec2');this.scene.fog=new THREE.FogExp2('#bdcacf',.000155);
    const panorama=new THREE.TextureLoader().load('./assets/coastal-skyline.webp',texture=>{texture.colorSpace=THREE.SRGBColorSpace;this.scene.background=texture;});
    panorama.colorSpace=THREE.SRGBColorSpace;this.scene.background=panorama;
    this.camera=new THREE.PerspectiveCamera(73,innerWidth/innerHeight,1,9500);
    this.camera.position.set(0,1797,1692);this.lookTarget=new THREE.Vector3(0,1732,1280);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.27;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Parachute Word Dive 3D game view');
    container.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#eff7ff','#637b75',2.25));
    const sun=new THREE.DirectionalLight('#ffead4',2.0);sun.position.set(-900,2500,1500);this.scene.add(sun);
    sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-950;sun.shadow.camera.right=950;sun.shadow.camera.top=950;sun.shadow.camera.bottom=-950;sun.shadow.camera.far=4000;sun.shadow.bias=-.0002;
    const rim=new THREE.DirectionalLight('#9dcff5',.45);rim.position.set(400,1100,-1200);this.scene.add(rim);
    this.makeTerrain();this.makeCity();this.makeClouds();this.makeAvatar();this.makeLandingZone();this.makeAirplane();
    this.resize();
  }

  resize(){
    const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
    this.camera.aspect=w/h;this.camera.fov=w/h<.75?81:72;this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,h,false);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,w<500?1.5:1.7));
  }

  makeTerrain(){
    const satellite=new THREE.TextureLoader().load('./assets/coastal-map.webp');satellite.colorSpace=THREE.SRGBColorSpace;satellite.anisotropy=8;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(7000,7000),new THREE.MeshStandardMaterial({map:satellite,roughness:1,metalness:0}));
    ground.rotation.x=-Math.PI/2;ground.position.set(0,-7,-300);ground.receiveShadow=true;this.scene.add(ground);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(2800,5200),new THREE.MeshStandardMaterial({color:'#5e9caa',metalness:.25,roughness:.4,transparent:true,opacity:.94}));
    water.rotation.x=-Math.PI/2;water.position.set(3550,-5.5,-330);this.scene.add(water);
    const shore=new THREE.Mesh(new THREE.PlaneGeometry(145,5000),new THREE.MeshStandardMaterial({color:'#d2c9a6',roughness:1}));
    shore.rotation.x=-Math.PI/2;shore.position.set(2240,-5.2,-320);this.scene.add(shore);
    const farTexture=cityTexture();farTexture.wrapS=farTexture.wrapT=THREE.RepeatWrapping;farTexture.repeat.set(3,3);
    const farLand=new THREE.Mesh(new THREE.PlaneGeometry(14000,13500),new THREE.MeshStandardMaterial({map:farTexture,roughness:1}));
    farLand.rotation.x=-Math.PI/2;farLand.position.set(0,-25,-750);this.scene.add(farLand);
    const rng=random(4242);
    for(let i=0;i<36;i++){
      const x=-4400+i*250+rng()*160,z=-3200-rng()*1400,height=170+rng()*580,radius=190+rng()*310;
      const mountain=new THREE.Mesh(new THREE.ConeGeometry(radius,height,5),new THREE.MeshLambertMaterial({color:['#839c9d','#82938c','#6b8a8d','#97a59b'][i%4],flatShading:true}));
      mountain.position.set(x,height*.45-25,z);mountain.rotation.y=rng()*Math.PI;this.scene.add(mountain);
    }
  }

  makeCity(){
    const rng=random(9722),max=1500;
    const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.87,metalness:.06});
    const instanced=new THREE.InstancedMesh(geometry,material,max);instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy=new THREE.Object3D(),shade=new THREE.Color();let index=0;
    for(let iz=-15;iz<=15;iz++)for(let ix=-16;ix<=16;ix++){
      if(index>=max||rng()<.23)continue;
      const x=ix*129+(rng()-.5)*49,z=iz*126-315+(rng()-.5)*43;
      if(x>2150||Math.hypot(x+660,z+910)<160||Math.hypot(x-570,z+400)<125)continue;
      const downtown=Math.exp(-Math.pow((x-65)/560,2)-Math.pow((z+390)/560,2));
      const h=8+Math.pow(rng(),2.2)*(48+downtown*110)+(downtown>.55&&rng()>.76?100+rng()*130:0);
      const bw=39+rng()*50,bd=38+rng()*50;
      dummy.position.set(x,h/2-5,z);dummy.scale.set(bw,h,bd);dummy.rotation.set(0,rng()<.12?rng()*.18:0,0);dummy.updateMatrix();
      instanced.setMatrixAt(index,dummy.matrix);
      shade.set(colors[Math.floor(rng()*colors.length)]);shade.multiplyScalar(.81+rng()*.34);instanced.setColorAt(index,shade);index++;
    }
    instanced.count=index;instanced.instanceMatrix.needsUpdate=true;if(instanced.instanceColor)instanced.instanceColor.needsUpdate=true;
    this.scene.add(instanced);
    const towerWindows=document.createElement('canvas');towerWindows.width=128;towerWindows.height=256;
    const tx=towerWindows.getContext('2d');tx.fillStyle='#627b84';tx.fillRect(0,0,128,256);
    for(let y=9;y<256;y+=16)for(let x=8;x<128;x+=16){tx.fillStyle=(x*y)%5===0?'#d4d4bc':'#a2bec1';tx.fillRect(x,y,7,7);}
    const wallTex=new THREE.CanvasTexture(towerWindows);wallTex.colorSpace=THREE.SRGBColorSpace;wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping;wallTex.repeat.set(3,5);
    const towerMat=new THREE.MeshStandardMaterial({map:wallTex,metalness:.18,roughness:.75});
    for(let i=0;i<39;i++){
      const angle=i*2.399,dist=Math.sqrt(i+1)*57,ht=90+rng()*290;
      const width=31+rng()*39,depth=32+rng()*40;
      const tower=new THREE.Mesh(new THREE.BoxGeometry(width,ht,depth),i%5===0?new THREE.MeshStandardMaterial({color:'#879aa4',metalness:.34,roughness:.35}):towerMat);
      tower.position.set(Math.cos(angle)*dist+40,ht/2-5,Math.sin(angle)*dist-420);
      tower.castShadow=true;
      this.scene.add(tower);
      const roof=new THREE.Mesh(new THREE.BoxGeometry(width*.56,4,depth*.49),new THREE.MeshStandardMaterial({color:i%2?'#b2bcc1':'#71848c',roughness:.8}));
      roof.position.set(tower.position.x,ht-1,tower.position.z);this.scene.add(roof);
      if(i%6===0){
        const spire=new THREE.Mesh(new THREE.CylinderGeometry(.9,2,18,7),new THREE.MeshStandardMaterial({color:'#a6adb1',metalness:.55,roughness:.45}));
        spire.position.set(tower.position.x,ht+10,tower.position.z);this.scene.add(spire);
      }
    }
    // A readable stadium landmark, bridges, and an oval race track.
    const stadium=new THREE.Group();stadium.position.set(-650,0,-900);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(100,118,24,40,1,true),new THREE.MeshStandardMaterial({color:'#c8ccc2',side:THREE.DoubleSide,roughness:.92}));
    bowl.scale.z=.7;bowl.position.y=8;stadium.add(bowl);
    const turf=new THREE.Mesh(new THREE.CircleGeometry(94,50),new THREE.MeshBasicMaterial({color:'#568c63'}));turf.rotation.x=-Math.PI/2;turf.scale.y=.66;turf.position.y=4;stadium.add(turf);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(103,8,10,48),new THREE.MeshStandardMaterial({color:'#c2c9c3',roughness:.86}));rim.rotation.x=-Math.PI/2;rim.scale.y=.72;rim.position.y=20;stadium.add(rim);
    this.scene.add(stadium);
    const park=new THREE.Mesh(new THREE.CircleGeometry(145,40),new THREE.MeshStandardMaterial({color:'#6b966a',roughness:1}));park.rotation.x=-Math.PI/2;park.position.set(570,-3,-400);this.scene.add(park);
    const rngTree=random(543);const trunkGeo=new THREE.CylinderGeometry(2.2,3.4,13,6),leafGeo=new THREE.ConeGeometry(12,29,8);
    const trunkMat=new THREE.MeshStandardMaterial({color:'#715a45'}),leafMat=new THREE.MeshStandardMaterial({color:'#426d59',roughness:1});
    const trees=new THREE.InstancedMesh(leafGeo,leafMat,110),trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,110),treeDummy=new THREE.Object3D();
    for(let i=0;i<110;i++){
      const a=rngTree()*Math.PI*2,r=Math.sqrt(rngTree())*130,x=570+Math.cos(a)*r,z=-400+Math.sin(a)*r;
      treeDummy.position.set(x,19,z);treeDummy.scale.setScalar(.65+rngTree()*.65);treeDummy.updateMatrix();trees.setMatrixAt(i,treeDummy.matrix);
      treeDummy.position.y=4;treeDummy.scale.setScalar(.8);treeDummy.updateMatrix();trunks.setMatrixAt(i,treeDummy.matrix);
    }
    this.scene.add(trees,trunks);
  }

  makeClouds(){
    const rng=random(1947),texture=cloudTexture();
    for(let i=0;i<80;i++){
      const material=new THREE.SpriteMaterial({map:texture,color:'#ffffff',transparent:true,opacity:.18+rng()*.29,depthWrite:false});
      const sprite=new THREE.Sprite(material),size=150+rng()*390;
      sprite.position.set((rng()-.5)*3000,220+rng()*1760,(rng()-.5)*4000-200);
      sprite.scale.set(size,size*.55,1);
      this.scene.add(sprite);this.clouds.push({sprite,phase:rng()*7,speed:.5+rng()*2});
    }
  }

  makeAvatar(){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const torso=cylinder(2.25,2.5,7.2,'#d8d8d1',body,0,1.0,0,12);torso.scale.z=.7;
    const shoulders=ball(2.45,'#dddcd5',body,0,3.25,0,16);shoulders.scale.set(1.25,.66,.74);
    const belt=cylinder(2.4,2.4,.8,'#5a615e',body,0,-2.7,0);belt.scale.z=.73;
    cylinder(.9,1.05,1.2,'#cba080',body,0,5.1,0);
    ball(1.83,'#cda78e',body,0,6.7,-.2,18);
    const hair=ball(1.84,'#292b2b',body,0,7.2,.12,18);hair.scale.y=.47;
    const nose=ball(.37,'#c59a80',body,0,6.6,-1.92,10);nose.scale.z=1.6;
    const pack=new THREE.Mesh(new THREE.BoxGeometry(3.6,4.8,1.6),new THREE.MeshStandardMaterial({color:'#434b4f',roughness:.92}));pack.position.set(0,.9,1.62);body.add(pack);
    const packPanel=new THREE.Mesh(new THREE.BoxGeometry(2.9,3.8,.22),new THREE.MeshStandardMaterial({color:'#596768',roughness:.84}));packPanel.position.set(0,.75,2.53);body.add(packPanel);
    this.forearms=[];this.knees=[];
    for(const sign of [-1,1]){
      const strap=new THREE.Mesh(new THREE.BoxGeometry(.55,6.8,.25),new THREE.MeshStandardMaterial({color:'#60615b'}));strap.position.set(sign*1.55,.95,-1.65);body.add(strap);
      const armPivot=new THREE.Group();armPivot.position.set(sign*2.5,3.1,0);body.add(armPivot);
      cylinder(.91,.8,4.5,'#d8d8d1',armPivot,0,-2.15,0,12);
      const forearm=new THREE.Group();forearm.position.y=-4.2;armPivot.add(forearm);
      cylinder(.68,.63,2.4,'#c9a185',forearm,0,-1.0,0,12);
      ball(.68,'#b98d72',forearm,0,-2.40,-.05);
      forearm.rotation.x=.12;this.forearms.push({forearm,sign});
      armPivot.rotation.z=sign*1.28;
      const legPivot=new THREE.Group();legPivot.position.set(sign*1.55,-3.2,0);body.add(legPivot);
      cylinder(1.02,.88,4.2,'#525a5c',legPivot,0,-2.05,0,12);
      const knee=new THREE.Group();knee.position.y=-4.05;legPivot.add(knee);
      cylinder(.91,.73,2.5,'#525a5c',knee,0,-1.1,0,12);
      const boot=new THREE.Mesh(new THREE.BoxGeometry(1.65,1.7,2.7),new THREE.MeshStandardMaterial({color:'#3f3935',roughness:.92}));boot.position.set(0,-5.76,-.6);legPivot.add(boot);
      boot.position.set(0,-2.9,-.55);knee.add(boot);
      this.knees.push({knee,sign});
      legPivot.rotation.z=sign*.22;
      if(sign===-1){this.armLeft=armPivot;this.legLeft=legPivot;}else{this.armRight=armPivot;this.legRight=legPivot;}
    }
    root.scale.setScalar(1.46);
    this.avatarRoot=root;this.avatarBody=body;this.scene.add(root);
    // Keep the SAME photorealistic character in both flight phases. The second
    // image is an identity-matched standing pose, not a different 3D mannequin.
    const diverTexture=new THREE.TextureLoader().load('./assets/skydiver-cutout.webp');
    diverTexture.colorSpace=THREE.SRGBColorSpace;
    const diverMat=new THREE.SpriteMaterial({map:diverTexture,color:'#ffffff',transparent:true,alphaTest:.05,depthTest:true,depthWrite:false});
    this.diverSprite=new THREE.Sprite(diverMat);
    this.diverSprite.scale.set(43,39,1);
    this.scene.add(this.diverSprite);
    const chuteTexture=new THREE.TextureLoader().load('./assets/skydiver-canopy-pose.webp');
    chuteTexture.colorSpace=THREE.SRGBColorSpace;
    const chuteMat=new THREE.SpriteMaterial({map:chuteTexture,color:'#ffffff',transparent:true,alphaTest:.05,depthTest:true,depthWrite:false});
    this.chuteSprite=new THREE.Sprite(chuteMat);
    this.chuteSprite.scale.set(34,51,1);
    this.chuteSprite.visible=false;
    this.scene.add(this.chuteSprite);
    this.makeParachute();
  }

  makeParachute(){
    const rig=new THREE.Group();
    const positions=[],colorValues=[],indices=[];
    const rowCount=16,colCount=48;
    const stripeColors=['#e77f6d','#f4be85','#f3f2d6','#54c6bd','#239bb0','#f4f1dc','#f3b88c','#e47967','#f4f3db'];
    for(let iz=0;iz<=rowCount;iz++)for(let ix=0;ix<=colCount;ix++){
      const xn=ix/colCount*2-1,zn=iz/rowCount*2-1;
      const dome=Math.sqrt(Math.max(0,1-xn*xn));
      // Full-size ram-air canopy: more than twice the old span, with a deeper
      // inflated arch, so it dwarfs the skydiver like a real parachute.
      const y=3+dome*(20-3*zn*zn);
      const x=xn*49,z=zn*16*(.7+.3*dome);
      positions.push(x,y,z);
      const ci=Math.min(stripeColors.length-1,Math.floor(ix/colCount*stripeColors.length));
      const color=new THREE.Color(stripeColors[ci]);color.multiplyScalar(1-.12*zn*zn);
      colorValues.push(color.r,color.g,color.b);
    }
    for(let iz=0;iz<rowCount;iz++)for(let ix=0;ix<colCount;ix++){
      const a=iz*(colCount+1)+ix,b=a+1,c=a+(colCount+1),d=c+1;
      indices.push(a,c,b,b,c,d);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colorValues,3));geo.setIndex(indices);geo.computeVertexNormals();
    const fabric=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({side:THREE.DoubleSide,vertexColors:true,roughness:.91,metalness:0}));
    rig.add(fabric);
    const cordMat=new THREE.LineBasicMaterial({color:'#f3f1de',transparent:true,opacity:.85});
    for(const side of [-1,1])for(let i=0;i<6;i++){
      const x=side*(13+i*6.7),xn=x/49,y=3+Math.sqrt(Math.max(0,1-xn*xn))*20;
      // Suspension cords meet the real jumper's raised hands instead of the mannequin's shoulders.
      const pts=[new THREE.Vector3(x,y,-8),new THREE.Vector3(side*12.5,-11,3),new THREE.Vector3(x,y,8),new THREE.Vector3(side*12.5,-11,3)];
      const cord=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),cordMat);rig.add(cord);
    }
    this.chuteRig=rig;rig.visible=false;this.scene.add(rig);
  }

  makeLandingZone(){
    const base=new THREE.Group();base.position.set(0,-3,-650);this.scene.add(base);
    const pad=new THREE.Mesh(new THREE.CircleGeometry(86,64),new THREE.MeshStandardMaterial({color:'#154c52',roughness:.98}));
    pad.rotation.x=-Math.PI/2;pad.position.y=.15;base.add(pad);
    for(const r of [70,49,25]){
      const torus=new THREE.Mesh(new THREE.TorusGeometry(r,2.8,8,60),new THREE.MeshBasicMaterial({color:'#b7ffdc',transparent:true,opacity:.9}));
      torus.rotation.x=-Math.PI/2;torus.position.y=.4;base.add(torus);
    }
    const mark=new THREE.Mesh(new THREE.RingGeometry(1,10,32),new THREE.MeshBasicMaterial({color:'#efffe0',side:THREE.DoubleSide}));mark.rotation.x=-Math.PI/2;mark.position.y=.48;base.add(mark);
    const label=createTextSprite('LAND HERE',118,40);label.position.set(0,125,0);base.add(label);
    this.landingZone=base;this.landingLabel=label;
  }

  makeAirplane(){
    const plane=new THREE.Group();
    const mat=new THREE.MeshStandardMaterial({color:'#eeeae0',metalness:.18,roughness:.45});
    const wingMat=new THREE.MeshStandardMaterial({color:'#238c9a',roughness:.5});
    const fuselage=new THREE.Mesh(new THREE.CylinderGeometry(2,2.7,29,10),mat);fuselage.rotation.x=Math.PI/2;plane.add(fuselage);
    const wings=new THREE.Mesh(new THREE.BoxGeometry(38,.7,6.2),wingMat);wings.position.z=-1;plane.add(wings);
    const tail=new THREE.Mesh(new THREE.BoxGeometry(15,.6,4),mat);tail.position.z=10;plane.add(tail);
    const tailFin=new THREE.Mesh(new THREE.BoxGeometry(.7,5,6),wingMat);tailFin.position.set(0,2.2,11);plane.add(tailFin);
    const prop=new THREE.Mesh(new THREE.BoxGeometry(11,.3,.6),new THREE.MeshStandardMaterial({color:'#292f38'}));prop.position.z=-15;plane.add(prop);
    plane.rotation.y=.36;plane.scale.setScalar(1.35);
    this.airplane=plane;this.scene.add(plane);
  }

  setRings(rings){
    for(const group of this.ringGroups){
      this.scene.remove(group);
      group.traverse(obj=>{if(obj.geometry)obj.geometry.dispose();if(obj.material){if(obj.material.map)obj.material.map.dispose();obj.material.dispose();}});
    }
    this.ringGroups=[];
    for(const ring of rings){
      const group=new THREE.Group();group.position.set(ring.x,ring.y,ring.z);
      const torus=new THREE.Mesh(new THREE.TorusGeometry(30,.38,8,64),new THREE.MeshBasicMaterial({color:'#c2fff0',transparent:true,opacity:.90}));
      torus.rotation.x=-Math.PI/2;group.add(torus);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(32,.12,6,64),new THREE.MeshBasicMaterial({color:'#edfff4',transparent:true,opacity:.19}));
      halo.rotation.x=-Math.PI/2;group.add(halo);
      const disc=new THREE.Mesh(new THREE.CircleGeometry(27,50),new THREE.MeshBasicMaterial({color:'#62e9cc',transparent:true,opacity:.018,side:THREE.DoubleSide,depthWrite:false}));
      disc.rotation.x=-Math.PI/2;disc.position.y=-.2;group.add(disc);
      const label=createTextSprite(ring.word,82,27);label.position.set(0,48,-2);group.add(label);
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,37,6),new THREE.MeshBasicMaterial({color:'#9cf4e4',transparent:true,opacity:.05}));
      post.position.set(0,20,0);group.add(post);
      group.userData={id:ring.id,halo,torus,label,baseY:ring.y};
      this.scene.add(group);this.ringGroups.push(group);
    }
  }

  pickRing(clientX,clientY){
    const rect=this.renderer.domElement.getBoundingClientRect();let nearest=null,best=74;
    for(const group of this.ringGroups){
      const center=group.position.clone().project(this.camera);
      const px=rect.left+(center.x+1)*rect.width/2,py=rect.top+(1-center.y)*rect.height/2;
      const d=Math.hypot(clientX-px,clientY-py);
      if(d<best){best=d;nearest=group.userData.id;}
    }
    return nearest;
  }

  burst(x,y,z){
    const rng=Math.random;
    const particles=[];
    for(let i=0;i<24;i++){
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.9+rng()*1.7,6,5),new THREE.MeshBasicMaterial({color:i%3===0?'#ffe5ae':'#a2ffe0',transparent:true,opacity:1}));
      mesh.position.set(x+(rng()-.5)*12,y+(rng()-.5)*12,z+(rng()-.5)*12);
      this.scene.add(mesh);particles.push({mesh,v:new THREE.Vector3((rng()-.5)*50,10+rng()*52,(rng()-.5)*50),life:1});
    }
    this.particles.push(...particles);
  }

  onNewFlight(){
    this.airplane.visible=true;this.landingZone.visible=false;
    for(const p of this.particles){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}this.particles=[];
  }
  resetCamera(){this.camera.position.set(0,1797,1692);this.lookTarget.set(0,1732,1280);}
  toggleCamera(){this.cameraMode=this.cameraMode==='chase'?'overhead':'chase';}

  update(game,dt){
    this.worldTime+=dt;
    const t=this.worldTime;
    const idle=game.phase==='ready';
    const chute=game.phase==='chute'||game.phase==='paused-chute'||(game.phase==='landed'&&game.chuteScale>.2);
    const alt=idle?1750:game.alt,x=idle?Math.sin(t*.16)*7:game.x,z=idle?1500:game.z;
    this.avatarRoot.position.set(x,alt,z);
    this.avatarRoot.visible=false;
    this.diverSprite.position.set(x,alt+1,z);
    this.chuteSprite.position.set(x,alt+1,z);
    const poseMix=chute?clamp((game.chuteScale||0)*1.8,0,1):0;
    this.diverSprite.visible=poseMix<.998;
    this.chuteSprite.visible=poseMix>.002;
    this.diverSprite.material.opacity=1-poseMix;
    this.chuteSprite.material.opacity=poseMix;
    this.diverSprite.material.rotation=lerp(this.diverSprite.material.rotation,-clamp(game.vx*.004,-.27,.27)+Math.sin(t*1.2)*.015,Math.min(1,dt*3));
    this.chuteSprite.material.rotation=lerp(this.chuteSprite.material.rotation,-clamp(game.vx*.0027,-.17,.17)+Math.sin(t*1.2)*.012,Math.min(1,dt*2.5));
    const wingPitch=clamp((-game.vz-28)/90,-.7,.8);
    this.diverSprite.scale.set(43*(1-Math.abs(wingPitch)*.085),39*(1+wingPitch*.085),1);
    const pose=chute?-.10:-1.2+wingPitch*.32;
    this.avatarRoot.rotation.x=lerp(this.avatarRoot.rotation.x,pose,Math.min(1,dt*3));
    this.avatarRoot.rotation.z=lerp(this.avatarRoot.rotation.z,-game.steerX*.35+Math.sin(t*1.35)*.012,Math.min(1,dt*3));
    this.avatarRoot.rotation.y=lerp(this.avatarRoot.rotation.y,game.steerX*.12,Math.min(1,dt*2));
    this.armLeft.rotation.z=-1.28+Math.sin(t*4)*.10*(chute?.3:1);
    this.armRight.rotation.z=1.28-Math.sin(t*4+.5)*.10*(chute?.3:1);
    this.armLeft.rotation.x=chute?-.32:-.11+wingPitch*.22+Math.sin(t*2.4)*.07;
    this.armRight.rotation.x=chute?-.32:.11+wingPitch*.22+Math.cos(t*2.4)*.07;
    this.legLeft.rotation.x=wingPitch*.25+Math.sin(t*3.2)*.09;
    this.legRight.rotation.x=wingPitch*.25-Math.sin(t*3.2+.8)*.11;
    for(const {forearm,sign} of this.forearms)forearm.rotation.x=(chute?.22:-.35)+sign*Math.sin(t*3.3)*.08;
    for(const {knee,sign} of this.knees)knee.rotation.x=(chute?.10:.40)+Math.cos(t*2.8+sign)*.11;
    this.avatarBody.position.y=Math.sin(t*2.2)*.08;
    this.chuteRig.visible=chute;
    if(chute){
      this.chuteRig.position.set(x,alt+31+Math.sin(t*2)*.7,z+2);
      const scale=clamp(game.chuteScale||.04,.04,1);this.chuteRig.scale.setScalar(scale);
      this.chuteRig.rotation.z=game.steerX*.09;
      this.chuteRig.rotation.x=Math.sin(t*1.8)*.025;
    }
    this.airplane.position.set(-150+t*17,alt+110,z+270+t*6);this.airplane.visible=idle||game.elapsed<7;
    const destination=this.cameraMode==='overhead'?
      new THREE.Vector3(x-game.vx*.17,alt+235,z+156):new THREE.Vector3(x-game.vx*.22,alt+66,z+185+clamp(game.vz+28,-85,85)*.15);
    const look=this.cameraMode==='overhead'?
      new THREE.Vector3(x,alt-180,z-80):new THREE.Vector3(x+game.vx*.08,alt-77,z-226);
    const camT=1-Math.exp(-dt*2.15),lookT=1-Math.exp(-dt*3.1);
    this.camera.position.lerp(destination,camT);this.lookTarget.lerp(look,lookT);
    const nominalFov=(this.renderer.domElement.clientWidth/this.renderer.domElement.clientHeight<.75?81:72);
    this.camera.fov=lerp(this.camera.fov,nominalFov+(chute?-4:3),Math.min(1,dt*.65));this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.lookTarget);
    for(let i=0;i<this.ringGroups.length;i++){
      const group=this.ringGroups[i],ud=group.userData;
      group.position.y=ud.baseY+Math.sin(t*2.4+i)*1.3;
      ud.halo.material.opacity=.29+Math.sin(t*3+i)*.07;
      ud.torus.scale.setScalar(1+Math.sin(t*2.7+i)*.018);
      ud.torus.material.color.set(game.glideTarget===ud.id&&game.easy?'#ffe8ad':'#c2fff0');
      ud.label.material.rotation=Math.sin(t+i)*.007;
    }
    for(const c of this.clouds){c.sprite.position.x+=c.speed*dt;c.sprite.material.opacity*=1;}
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.life-=dt*1.18;p.mesh.position.addScaledVector(p.v,dt);p.v.y-=dt*24;p.mesh.material.opacity=clamp(p.life,0,1);
      if(p.life<=0){this.scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.particles.splice(i,1);}
    }
    this.landingZone.visible=game.alt<650||game.phase==='landed';
    if(this.landingZone.visible){this.landingLabel.position.y=118+Math.sin(t*2)*8;this.landingLabel.material.opacity=.88;}
    this.renderer.render(this.scene,this.camera);
  }
}
