import * as THREE from 'three';

export const RUNWAY = { x: 1700, z: 1000, y: 5, length: 1600, width: 52, heading: 0 };

export function createEnvironment(scene) {
  const group = new THREE.Group(); scene.add(group);
  const airport = new THREE.Group(); group.add(airport);
  const obstacles = [];
  const mat = (color, roughness=.82, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
  const asphalt=mat(0x343c42), line=mat(0xe7e7d8), grass=mat(0x778b64), edge=mat(0x637d77), steel=mat(0xaebfc6,.46,.32), glass=mat(0x245465,.24,.56);
  function box(w,h,d,material,x,y,z,parent=airport) {const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;}
  box(300,10,1840,edge,RUNWAY.x,-.1,RUNWAY.z);
  box(294,.5,1836,grass,RUNWAY.x,4.95,RUNWAY.z);
  box(RUNWAY.width,.18,RUNWAY.length,asphalt,RUNWAY.x,5.3,RUNWAY.z);
  for(const s of [-1,1]) box(.8,.03,RUNWAY.length-12,line,RUNWAY.x+s*24.5,5.41,RUNWAY.z);
  for(let i=-740;i<760;i+=65)box(1.2,.035,28,line,RUNWAY.x,5.42,RUNWAY.z+i);
  for(const end of [-1,1]) {
    for(let j=-4;j<=4;j++)if(j!==0)box(2,.035,36,line,RUNWAY.x+j*4.7,5.43,RUNWAY.z+end*746);
    for(const s of [-1,1])box(6,.035,34,line,RUNWAY.x+s*13,5.43,RUNWAY.z+end*525);
    const cv=document.createElement('canvas');cv.width=256;cv.height=256;const c=cv.getContext('2d');c.fillStyle='#343c42';c.fillRect(0,0,256,256);c.fillStyle='#f4f2de';c.font='bold 168px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(end===1?'36':'18',128,128);
    const tx=new THREE.CanvasTexture(cv);tx.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.Mesh(new THREE.PlaneGeometry(18,28),new THREE.MeshStandardMaterial({map:tx,roughness:1}));m.rotation.x=-Math.PI/2;m.rotation.z=end===1?0:Math.PI;m.position.set(RUNWAY.x,5.44,RUNWAY.z+end*669);airport.add(m);
  }
  // A compact fictional harbour training strip beside the real city.
  box(19,.14,1590,asphalt,RUNWAY.x+83,5.31,RUNWAY.z);
  box(78,.16,20,asphalt,RUNWAY.x+45,5.32,RUNWAY.z+600);
  box(78,.16,20,asphalt,RUNWAY.x+45,5.32,RUNWAY.z-600);
  const yellow=mat(0xd5b760);box(.65,.02,1510,yellow,RUNWAY.x+83,5.43,RUNWAY.z);
  box(59,.16,360,asphalt,RUNWAY.x+112,5.32,RUNWAY.z+400);
  const terminal=box(44,13,112,steel,RUNWAY.x+119,11.7,RUNWAY.z+390);obstacles.push({x:terminal.position.x,z:terminal.position.z,hw:22,hd:56,top:18.2});
  box(45,5.4,105,glass,RUNWAY.x+119,12.4,RUNWAY.z+390);
  box(48,1,116,mat(0xe6e5db),RUNWAY.x+119,18.6,RUNWAY.z+390);
  for(let i=0;i<6;i++)box(.6,6,106,steel,RUNWAY.x+98+i*8,12,RUNWAY.z+390);
  box(8,33,8,steel,RUNWAY.x+119,21.5,RUNWAY.z+295);
  box(19,7,17,glass,RUNWAY.x+119,41,RUNWAY.z+295);
  box(21,1.3,19,mat(0xd4dbd6),RUNWAY.x+119,45.1,RUNWAY.z+295);
  obstacles.push({x:RUNWAY.x+119,z:RUNWAY.z+295,hw:11,hd:10,top:46});
  const lightMat = new THREE.MeshBasicMaterial({color:0xcff8ff});
  const lights=new THREE.InstancedMesh(new THREE.SphereGeometry(.38,5,4),lightMat,68);let li=0;const o=new THREE.Object3D();
  for(let i=-800;i<=800;i+=50)for(const s of [-1,1]){o.position.set(RUNWAY.x+s*29,5.8,RUNWAY.z+i);o.updateMatrix();lights.setMatrixAt(li++,o.matrix);} airport.add(lights);lights.count=li;
  const greenLight=new THREE.MeshBasicMaterial({color:0x91ffc7});
  for(let j=-4;j<=4;j++)box(.8,.4,.8,greenLight,RUNWAY.x+j*5,5.7,RUNWAY.z+798);
  // Wind sock and apron details provide scale on the ground.
  box(.5,17,.5,steel,RUNWAY.x-77,13.5,RUNWAY.z+570);
  const sock=new THREE.Mesh(new THREE.ConeGeometry(1.1,6,10,1,true),new THREE.MeshStandardMaterial({color:0xee7b43,side:THREE.DoubleSide}));sock.rotation.z=-Math.PI/2;sock.position.set(RUNWAY.x-74,21.5,RUNWAY.z+570);airport.add(sock);

  const hemi=new THREE.HemisphereLight(0xc7eaff,0x6c7470,2.1);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffefcf,3.2);sun.position.set(-2500,4200,-1800);scene.add(sun);
  scene.fog=new THREE.FogExp2(0xb4d4df,.000045);
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:{value:0},topColor:{value:new THREE.Color(0x477ea8)},horizonColor:{value:new THREE.Color(0xc9e2eb)},sunColor:{value:new THREE.Color(0xfff1cc)},sunDir:{value:new THREE.Vector3(-.45,.55,-.6).normalize()},warm:{value:0}},vertexShader:`varying vec3 vDir; void main(){ vDir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,fragmentShader:`varying vec3 vDir; uniform vec3 topColor,horizonColor,sunColor,sunDir; uniform float time,warm;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);} float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<4;i++){f+=a*noise(p);p=p*2.03+4.17;a*=.5;}return f;}
    void main(){vec3 d=normalize(vDir);float h=max(d.y,0.);vec3 c=mix(horizonColor,topColor,pow(h,.43));float s=max(dot(d,sunDir),0.);c+=sunColor*(pow(s,480.)*1.4+pow(s,18.)*.16);if(d.y>.035){vec2 p=d.xz/(d.y+.18)*2.1+vec2(time*.0015,0);float n=fbm(p);float cloud=smoothstep(.52,.73,n)*smoothstep(.02,.17,d.y)*(1.-smoothstep(.6,.9,d.y));c=mix(c,mix(vec3(.95,.97,.96),vec3(1.,.8,.66),warm),cloud*.68);}gl_FragColor=vec4(c,1.);}`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(18000,32,20),skyMaterial);scene.add(sky);
  const waterMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},sunDir:{value:new THREE.Vector3(-.45,.55,-.6).normalize()},waterColor:{value:new THREE.Color(0x397c8c)},skyColor:{value:new THREE.Color(0xbcdbe4)},eye:{value:new THREE.Vector3()}},vertexShader:`varying vec3 vWorld; varying vec2 vXZ; uniform float time; void main(){vec3 p=position; p.z+=sin(p.x*.018+time*.55)*.2+sin(p.y*.026-time*.7)*.12;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;vXZ=w.xz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vWorld;varying vec2 vXZ; uniform float time;uniform vec3 waterColor,skyColor,sunDir,eye;void main(){float a=sin(vXZ.x*.045+time*.7)*.16+sin(vXZ.y*.072-time*.52)*.11;float b=cos(vXZ.y*.051+time*.43)*.19+cos(vXZ.x*.09-time*.63)*.09;vec3 n=normalize(vec3(a,1.,b));vec3 v=normalize(eye-vWorld);float f=pow(1.-max(dot(v,n),0.),3.);vec3 c=mix(waterColor,skyColor,f*.64);float sh=pow(max(dot(reflect(-sunDir,n),v),0.),150.);c+=vec3(1.,.86,.64)*sh*.55;float waves=sin(vXZ.x*.33+vXZ.y*.17+sin(vXZ.x*.025)+time)*.018;c+=waves;float dist=length(eye-vWorld);c=mix(c,skyColor,1.-exp(-dist*.000045));gl_FragColor=vec4(c,1.);}`});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(40000,40000,130,130),waterMat);water.rotation.x=-Math.PI/2;water.position.y=-.25;scene.add(water);
  // Distant terrain blends the limited city extent into the horizon.
  const hillmat=mat(0x83978b);for(let i=0;i<18;i++){const hill=new THREE.Mesh(new THREE.SphereGeometry(1,16,8),hillmat);hill.scale.set(1300+i%3*520,210+(i*59)%180,900);hill.position.set(-8500+(i%4)*420,30,-10000+i*1300);scene.add(hill);}
  const boats=[];
  function ship(x,z,heading,scale=1){const g=new THREE.Group(); const hull=box(20,6,80,mat(0x263c48),0,3,0,g);box(18,2,74,mat(0xe4e0cd),0,7,0,g);box(15,12,19,mat(0xefeee5),0,13,23,g);box(12,3,13,glass,0,19,23,g);for(let j=0;j<4;j++)box(14,5,9,mat(j%2?0xa14c42:0x5b8492),0,10,-26+j*11,g);g.position.set(x,0,z);g.rotation.y=heading;g.scale.setScalar(scale);scene.add(g);boats.push(g);}
  ship(2600,-800,.3,1.2);ship(2950,2100,-.5,.65);ship(1550,-1800,1.2,.7);
  let preset='day';
  function setPreset(name){preset=name;const warm=name==='sunset';skyMaterial.uniforms.warm.value=warm?1:0;skyMaterial.uniforms.topColor.value.set(warm?0x597e9e:0x477ea8);skyMaterial.uniforms.horizonColor.value.set(warm?0xe6c5ad:0xc9e2eb);sun.color.set(warm?0xffc88d:0xffefcf);sun.intensity=warm?2.4:3.2;hemi.intensity=warm?1.9:2.1;scene.fog.color.set(warm?0xd6c1b6:0xb4d4df);waterMat.uniforms.skyColor.value.copy(scene.fog.color);waterMat.uniforms.waterColor.value.set(warm?0x4b7883:0x397c8c);}
  function groundHeightAt(x,z){if(Math.abs(x-RUNWAY.x)<=150&&Math.abs(z-RUNWAY.z)<=920)return 5.4;return null;}
  function obstacleHeightAt(x,z){let h=groundHeightAt(x,z);for(const b of obstacles)if(Math.abs(x-b.x)<b.hw+2&&Math.abs(z-b.z)<b.hd+2)h=Math.max(h??0,b.top);return h;}
  function isRunway(x,z){return Math.abs(x-RUNWAY.x)<RUNWAY.width*.5-2&&Math.abs(z-RUNWAY.z)<RUNWAY.length*.5-8;}
  function update(dt,time,camera){sky.position.copy(camera.position);skyMaterial.uniforms.time.value=time;waterMat.uniforms.time.value=time;waterMat.uniforms.eye.value.copy(camera.position);sock.rotation.y=Math.sin(time*.7)*.12;boats.forEach((b,i)=>{b.rotation.z=Math.sin(time*.43+i)*.012;b.position.y=Math.sin(time*.55+i)*.25;});}
  return {group,runway:RUNWAY,groundHeightAt,obstacleHeightAt,isRunway,setPreset,update,get preset(){return preset;}};
}

export function createAircraft(){
 const g=new THREE.Group(),white=new THREE.MeshStandardMaterial({color:0xd6dee0,metalness:.62,roughness:.3}),dark=new THREE.MeshStandardMaterial({color:0x153347,metalness:.6,roughness:.22}),accent=new THREE.MeshStandardMaterial({color:0xe8a35b,metalness:.25,roughness:.4});
 function add(geo,mat,x,y,z,rx=0,ry=0,rz=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m;}
 const profile=[new THREE.Vector2(.03,-8),new THREE.Vector2(.55,-6.5),new THREE.Vector2(1,-4),new THREE.Vector2(1.2,-1.5),new THREE.Vector2(1.1,2.8),new THREE.Vector2(.75,5.5),new THREE.Vector2(.15,7.2)];add(new THREE.LatheGeometry(profile,32),white,0,0,0,Math.PI/2);
 add(new THREE.SphereGeometry(1,24,12),dark,0,.75,-4).scale.set(.83,.65,1.9);
 for(const s of [-1,1]){const sh=new THREE.Shape();sh.moveTo(s*.65,-1.8);sh.lineTo(s*8.1,2.4);sh.lineTo(s*8.2,3.3);sh.lineTo(s*1.1,2.4);sh.closePath();const wing=add(new THREE.ExtrudeGeometry(sh,{depth:.18,bevelEnabled:true,bevelSize:.08,bevelThickness:.06,bevelSegments:1}),white,0,-.3,0,Math.PI/2);add(new THREE.CylinderGeometry(.65,.56,3.8,20),white,s*1.55,.2,3.1,Math.PI/2);add(new THREE.CylinderGeometry(.43,.44,.09,20),dark,s*1.55,.2,5.02,Math.PI/2);const tail=add(new THREE.BoxGeometry(4.4,.14,1.15),white,s*1.9,.65,5.4,0,-s*.22);tail.rotation.z=s*.07;add(new THREE.SphereGeometry(.1,8,6),new THREE.MeshBasicMaterial({color:s<0?0xff5245:0x84ffad}),s*8.1,-.27,-3.05);}
 const finShape=new THREE.Shape();finShape.moveTo(0,0);finShape.lineTo(0,3.3);finShape.lineTo(2,2);finShape.lineTo(2.8,0);const fin=add(new THREE.ExtrudeGeometry(finShape,{depth:.15,bevelEnabled:false}),accent,0,0,4.3,0,Math.PI/2); 
 const gear=new THREE.Group();g.add(gear);for(const [x,z]of [[0,-4],[-1.25,1.7],[1.25,1.7]]){const strut=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,1.5,8),white);strut.position.set(x,-1.15,z);gear.add(strut);const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.21,12),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,-1.9,z);gear.add(wheel);}g.userData.gear=gear;return g;
}
