/** A little plush panda teacher. No external textures, skeleton files or loaders. */
export function createPanda(THREE) {
  const group = new THREE.Group();
  group.name = 'Pip the panda';
  const plush = new THREE.Group();
  group.add(plush);
  const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
  const smallSphere = new THREE.SphereGeometry(1, 20, 14);
  const furGeo = new THREE.SphereGeometry(1, 5, 3);
  let seed = 912783;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const texels = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < texels.length; i += 4) {
    const c = 220 + Math.floor(random() * 35);
    texels[i] = texels[i + 1] = texels[i + 2] = c;
    texels[i + 3] = 255;
  }
  const grain = new THREE.DataTexture(texels, 128, 128, THREE.RGBAFormat);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(5, 5);
  grain.magFilter = THREE.LinearFilter;
  grain.minFilter = THREE.LinearMipmapLinearFilter;
  grain.generateMipmaps = true;
  grain.needsUpdate = true;
  const cream = new THREE.MeshStandardMaterial({color:0xfff8e9, roughness:0.92, map:grain, bumpMap:grain, bumpScale:0.018});
  const black = new THREE.MeshStandardMaterial({color:0x242a2b, roughness:0.94, map:grain, bumpMap:grain, bumpScale:0.014});
  const innerEar = new THREE.MeshStandardMaterial({color:0x4a4547, roughness:1});
  const pads = new THREE.MeshStandardMaterial({color:0x58504e, roughness:0.9});
  const gloss = new THREE.MeshPhysicalMaterial({color:0x080d10, roughness:0.12, clearcoat:1, clearcoatRoughness:0.08});
  const irisMat = new THREE.MeshPhysicalMaterial({color:0x3d3027, roughness:0.2, clearcoat:1});
  const noseMat = new THREE.MeshStandardMaterial({color:0x17191a, roughness:0.36});
  const smileMat = new THREE.MeshStandardMaterial({color:0x34282a, roughness:0.8});
  const catchMat = new THREE.MeshBasicMaterial({color:0xfffff8});
  const pink = new THREE.MeshStandardMaterial({color:0xf28c9c, roughness:0.8});
  const blushMat = new THREE.MeshStandardMaterial({color:0xff9caa, roughness:1, transparent:true, opacity:0.4, depthWrite:false});
  const bambooMat = new THREE.MeshStandardMaterial({color:0x91aa43, roughness:0.8});
  const bambooRingMat = new THREE.MeshStandardMaterial({color:0xc2c779, roughness:0.8});
  function ellipsoid(parent, material, x, y, z, sx, sy, sz, small=false) {
    const m = new THREE.Mesh(small ? smallSphere : sphereGeo, material);
    m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow=true; m.receiveShadow=true;
    parent.add(m); return m;
  }
  // Short soft fibers use one instanced draw per body part, so the silhouette
  // has a plush edge without a costly hair simulation.
  function fuzz(parent, material, center, radii, count, frontCutoff=2) {
    const hair = new THREE.InstancedMesh(furGeo, material, count);
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0,1,0);
    const normal = new THREE.Vector3();
    let n=0;
    while(n<count) {
      const y=random()*2-1, az=random()*Math.PI*2, r=Math.sqrt(1-y*y);
      const x=Math.cos(az)*r, z=Math.sin(az)*r;
      if(z>frontCutoff) continue;
      normal.set(x/radii[0],y/radii[1],z/radii[2]).normalize();
      dummy.position.set(center[0]+x*radii[0],center[1]+y*radii[1],center[2]+z*radii[2]);
      dummy.quaternion.setFromUnitVectors(up,normal);
      const size=.003+random()*.003;
      dummy.scale.set(size,.010+random()*.014,size);
      dummy.updateMatrix(); hair.setMatrixAt(n++,dummy.matrix);
    }
    hair.frustumCulled=false;
    parent.add(hair);
    return hair;
  }
  const torso = ellipsoid(plush,black,0,1.20,-.01,.82,1.02,.64);
  const tummy = ellipsoid(plush,cream,0,1.17,.48,.68,.79,.245);
  fuzz(plush,cream,[0,1.17,.48],[.68,.79,.245],420,.40);
  fuzz(plush,black,[0,1.20,-.01],[.82,1.02,.64],250,.35);
  ellipsoid(plush,cream,0,.93,-.62,.21,.22,.20,true);
  // Little rounded feet and visible bean pads.
  const feet=[];
  for(const side of [-1,1]) {
    const foot=new THREE.Group(); foot.position.set(side*.43,.29,.12); plush.add(foot); feet.push(foot);
    ellipsoid(foot,black,0,.12,-.06,.34,.39,.36);
    ellipsoid(foot,black,0,-.025,.14,.36,.265,.43);
    ellipsoid(foot,pads,0,-.04,.515,.165,.12,.025,true);
    for(let j=0;j<3;j++) ellipsoid(foot,pads,(j-1)*.105,.115,.485,.047,.049,.019,true);
  }
  const leftArm = new THREE.Group(); leftArm.position.set(-.69,1.92,.01); plush.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(.69,1.92,.01); plush.add(rightArm);
  for(const [arm,side] of [[leftArm,-1],[rightArm,1]]) {
    ellipsoid(arm,black,side*.10,-.40,.025,.285,.57,.285);
    ellipsoid(arm,black,side*.14,-.76,.10,.27,.28,.285);
    ellipsoid(arm,pads,side*.14,-.77,.367,.115,.12,.018,true);
  }
  leftArm.rotation.z=-.12;
  rightArm.rotation.z=.25;
  // A slim teaching pointer, tucked naturally into the right paw.
  const pointer = new THREE.Group(); pointer.position.set(.15,-.74,.28); pointer.rotation.z=-.40; rightArm.add(pointer);
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.028,.037,1.75,9),bambooMat);
  rod.position.y=.67; pointer.add(rod); rod.castShadow=true;
  for(let j=0;j<5;j++) {
    const ring=new THREE.Mesh(new THREE.CylinderGeometry(.039,.039,.035,9),bambooRingMat);
    ring.position.y=-.04+j*.31; pointer.add(ring);
  }
  const tip=new THREE.Mesh(new THREE.ConeGeometry(.035,.17,10),bambooRingMat); tip.position.y=1.61; pointer.add(tip);
  // An oversized head with a gentle lower-cheek widening.
  const head = new THREE.Group(); head.position.set(0,2.73,.045); plush.add(head);
  const headGeo = sphereGeo.clone();
  const pos=headGeo.attributes.position;
  for(let i=0;i<pos.count;i++) {
    const y=pos.getY(i), widen=1+.055*Math.exp(-Math.pow((y+.30)*2.2,2));
    pos.setXYZ(i,pos.getX(i)*1.055*widen,y*.88,pos.getZ(i)*.80);
  }
  headGeo.computeVertexNormals();
  const headMesh=new THREE.Mesh(headGeo,cream); head.add(headMesh); headMesh.castShadow=true; headMesh.receiveShadow=true;
  fuzz(head,cream,[0,0,0],[1.075,.883,.80],1000,.62);
  const ears=[];
  for(const side of [-1,1]) {
    const ear=new THREE.Group(); ear.position.set(side*.79,.66,-.03); ear.rotation.z=-side*.18; head.add(ear); ears.push(ear);
    ellipsoid(ear,black,0,0,0,.32,.34,.23);
    ellipsoid(ear,innerEar,0,-.015,.195,.205,.225,.052);
    fuzz(ear,black,[0,0,0],[.32,.34,.23],85,.45);
  }
  const eyeGroups=[];
  for(const side of [-1,1]) {
    const patch=ellipsoid(head,black,side*.43,-.01,.714,.31,.385,.091);
    patch.rotation.z=side*.23; patch.rotation.y=side*.12;
    const eye = new THREE.Group(); eye.position.set(side*.43,.035,.799); head.add(eye); eyeGroups.push(eye);
    ellipsoid(eye,gloss,0,0,0,.193,.219,.073,true);
    ellipsoid(eye,irisMat,0,-.014,.059,.145,.164,.029,true);
    ellipsoid(eye,gloss,0,-.002,.081,.116,.139,.024,true);
    ellipsoid(eye,catchMat,-.050,.073,.099,.048,.053,.012,true);
    ellipsoid(eye,catchMat,.052,-.065,.102,.018,.020,.008,true);
    const blush=ellipsoid(head,blushMat,side*.686,-.27,.655,.17,.081,.019,true);
    blush.rotation.y=side*.40; blush.rotation.z=side*.10;
    // Tiny cheek whisker marks give a handmade plush finish.
  }
  ellipsoid(head,cream,-.133,-.305,.764,.244,.178,.111);
  ellipsoid(head,cream,.133,-.305,.764,.244,.178,.111);
  const noseShape=new THREE.Shape();
  noseShape.moveTo(-.095,.035); noseShape.quadraticCurveTo(-.11,.085,0,.080);
  noseShape.quadraticCurveTo(.11,.085,.095,.035); noseShape.quadraticCurveTo(.035,-.045,0,-.045);
  noseShape.quadraticCurveTo(-.035,-.045,-.095,.035);
  const noseGeo=new THREE.ExtrudeGeometry(noseShape,{depth:.036,bevelEnabled:true,bevelThickness:.016,bevelSize:.012,bevelSegments:3,steps:1,curveSegments:10});
  const nose=new THREE.Mesh(noseGeo,noseMat); nose.position.set(0,-.265,.869); head.add(nose);
  ellipsoid(head,catchMat,-.025,-.205,.919,.026,.011,.004,true);
  const mouth=new THREE.Group(); mouth.position.set(0,-.365,.878); head.add(mouth);
  ellipsoid(mouth,smileMat,0,-.027,0,.088,.079,.022,true);
  const tongue=ellipsoid(mouth,pink,0,-.064,.020,.055,.047,.014,true);
  const smileCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.125,.036,.008),new THREE.Vector3(-.069,-.004,.020),new THREE.Vector3(0,.006,.025),
    new THREE.Vector3(.069,-.004,.020),new THREE.Vector3(.125,.036,.008)
  ]);
  mouth.add(new THREE.Mesh(new THREE.TubeGeometry(smileCurve,24,.014,6,false),smileMat));
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.09,8),smileMat); stem.position.set(0,.064,.011); mouth.add(stem);
  // Keep neutral poses available for the animation mixer below.
  let event='idle', eventTime=-100, clock=0;
  let lastBlink=0, nextBlink=2.1;
  let talkingAmount=0;
  const tmp = { happy:0 };
  function react(kind='happy') {
    event=kind; eventTime=clock;
  }
  function update(time, dt=.016, state={}) {
    clock=time;
    const age=Math.max(0,time-eventTime);
    const joyful=(event==='happy'||event==='correct'||event==='dance'||event==='feed')&&age<2.0;
    const wrong=(event==='wrong'||event==='sad')&&age<1.4;
    const waving=(event==='wave'||event==='hello')&&age<2.5;
    const bounce=joyful?Math.sin(Math.min(1,age/.75)*Math.PI)*.19:0;
    plush.position.y=Math.sin(time*2)*.018+bounce;
    plush.rotation.z=joyful?Math.sin(age*11)*.045*Math.max(0,1-age/2):Math.sin(time*.73)*.012;
    torso.scale.y=1.02+Math.sin(time*2)*.009;
    tummy.scale.y=.79+Math.sin(time*2)*.007;
    head.rotation.z=Math.sin(time*.83)*.045+(wrong?Math.sin(age*11)*.11*(1-age/1.4):0);
    head.rotation.y=Math.sin(time*.42)*.055+(joyful?Math.sin(age*7)*.035:0);
    head.rotation.x=Math.sin(time*.6)*.025+(event==='feed'&&age<1.6?Math.sin(age*9)*.07:0);
    leftArm.rotation.z=-.12+Math.sin(time*1.7)*.035;
    rightArm.rotation.z=.25+Math.sin(time*1.15)*.04;
    leftArm.rotation.x=Math.sin(time*1.3)*.025;
    rightArm.rotation.x=-.05;
    if(joyful) {
      const strength=Math.sin(Math.min(age/1.9,1)*Math.PI);
      leftArm.rotation.z-=strength*.55;
      rightArm.rotation.z+=strength*.55;
      feet[0].rotation.x=Math.sin(age*9)*.11*strength;
      feet[1].rotation.x=-Math.sin(age*9)*.11*strength;
    } else {
      feet[0].rotation.x=feet[1].rotation.x=0;
    }
    if(waving || (time%16>12.2&&time%16<14.6)) {
      const t=waving?age:time%16-12.2;
      const strength=Math.min(1,t*5)*Math.min(1,(2.5-t)*5);
      leftArm.rotation.z=-.12-strength*(1.80+Math.sin(t*12)*.22);
      leftArm.rotation.x=-.12*strength;
    }
    for(let i=0;i<2;i++) ears[i].rotation.z=(i===0?.18:-.18)+Math.sin(time*1.2+i)*.012;
    if(time>nextBlink) { lastBlink=time; nextBlink=time+2.8+random()*3.2; }
    const b=time-lastBlink;
    let blink=b>=0&&b<.18?Math.max(.055,1-Math.sin(b/.18*Math.PI)):1;
    if(joyful && age>.25 && age<1.1) blink=Math.min(blink,.48);
    for(const eye of eyeGroups) eye.scale.y=blink;
    talkingAmount+=(Number(!!state.talking)-talkingAmount)*Math.min(1,dt*12);
    mouth.scale.y=1+talkingAmount*(.25+.3*Math.sin(time*18));
    tongue.scale.y=.047+(joyful?.010:0);
  }
  group.userData.panda = true;
  return {group,update,react};
}
