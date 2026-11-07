import * as THREE from './vendor/three.module.js';

/** The track uses arc-length distance everywhere. Local +Z is the direction of travel. */
export function createTrack(scene) {
  const points = [
    [-60,7,65],[-45,7,65],[-25,9,65],[-10,25,62],[8,53,56],
    [25,62,43],[42,55,25],[47,16,0],[35,6,-20],[10,7,-32],
    [-12,28,-48],[-27,36,-65],[-48,21,-75],[-70,8,-60],
    [-82,9,-30],[-75,22,-3],[-50,24,0],[-27,12,-5],[-5,6,0],
    [25,28,4],[55,34,-4],[75,18,-23],[85,8,-45],[75,7,-66],
    [50,8,-79],[24,8,-82],[8,14,-70],[-3,17,-55],[-10,9,-35],
    [-22,6,-20],[-42,7,-15],[-60,12,0],[-66,10,24],[-63,7,45]
  ].map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = 8192;
  curve.updateArcLengths();
  const length = curve.getLength();
  const worldUp = new THREE.Vector3(0,1,0);
  const wrap = d => ((d % length) + length) % length;
  const tangentAt = d => curve.getTangentAt(wrap(d) / length).normalize();
  const basis = new THREE.Matrix4();

  function getFrame(distanceMeters) {
    const d = wrap(distanceMeters);
    const position = curve.getPointAt(d / length);
    const tangent = tangentAt(d);
    const right = new THREE.Vector3().crossVectors(worldUp,tangent).normalize();
    const up = new THREE.Vector3().crossVectors(tangent,right).normalize();
    const before = tangentAt(d-6); before.y=0; before.normalize();
    const after = tangentAt(d+6); after.y=0; after.normalize();
    const angle = Math.atan2(new THREE.Vector3().crossVectors(before,after).y, before.dot(after));
    const curvature = angle/12;
    const bank = THREE.MathUtils.clamp(-Math.atan(curvature*18), -.71,.71);
    right.applyAxisAngle(tangent,bank);
    up.applyAxisAngle(tangent,bank);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(right,up,tangent));
    return {position,tangent,right,up,quaternion};
  }
  const samples = curve.getSpacedPoints(1200);
  const root = new THREE.Group(); root.name='Suncoast roller coaster'; scene.add(root);
  const mat = (color, extras={}) => new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.12,...extras});
  const railMat=mat(0xef6748,{metalness:.34,roughness:.31});
  const tieMat=mat(0xc34d3d), spineMat=mat(0xb74637);
  const steelMat=mat(0xf2ead3,{roughness:.48,metalness:.24});
  const tealMat=mat(0x306c6a,{roughness:.45,metalness:.23});
  const concreteMat=mat(0xd0cab5,{roughness:.9,metalness:0});
  const object = new THREE.Object3D();

  function tube(offsetX,offsetY,radius,material,radial=6) {
    const n=2200, positions=[],normals=[],indices=[];
    for(let i=0;i<=n;i++) {
      const f=getFrame(i/n*length);
      const center=f.position.clone().addScaledVector(f.right,offsetX).addScaledVector(f.up,offsetY);
      for(let j=0;j<radial;j++) {
        const a=j/radial*Math.PI*2;
        const normal=f.right.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.up,Math.sin(a));
        const p=center.clone().addScaledVector(normal,radius);
        positions.push(p.x,p.y,p.z); normals.push(normal.x,normal.y,normal.z);
      }
      if(i<n) for(let j=0;j<radial;j++) {
        const a=i*radial+j,b=i*radial+(j+1)%radial,c=(i+1)*radial+j,e=(i+1)*radial+(j+1)%radial;
        indices.push(a,b,c,b,e,c);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setIndex(indices);geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  tube(-1.24,0,.135,railMat,7);tube(1.24,0,.135,railMat,7);tube(0,-.86,.25,spineMat,6);
  const tieCount=Math.ceil(length/1.55);
  const ties=new THREE.InstancedMesh(new THREE.BoxGeometry(2.94,.19,.32),tieMat,tieCount);
  ties.castShadow=true;ties.receiveShadow=true;root.add(ties);
  const braces=new THREE.InstancedMesh(new THREE.CylinderGeometry(.061,.061,1,5),tieMat,tieCount*2);
  braces.castShadow=true;root.add(braces);
  const yAxis=new THREE.Vector3(0,1,0);
  function beamMatrix(a,b,radius=1) {
    const delta=new THREE.Vector3().subVectors(b,a);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(yAxis,delta.clone().normalize());
    object.scale.set(radius,delta.length(),radius);object.updateMatrix();return object.matrix;
  }
  for(let i=0;i<tieCount;i++) {
    const f=getFrame(i/tieCount*length);
    object.position.copy(f.position).addScaledVector(f.up,-.22);object.quaternion.copy(f.quaternion);object.scale.set(1,1,1);object.updateMatrix();ties.setMatrixAt(i,object.matrix);
    const b=f.position.clone().addScaledVector(f.up,-.83);
    for(let side=0;side<2;side++) {
      const a=f.position.clone().addScaledVector(f.right,side?1.2:-1.2).addScaledVector(f.up,-.18);
      braces.setMatrixAt(i*2+side,beamMatrix(a,b));
    }
  }
  // Supports at grade are kept out of lower, crossing portions of the circuit.
  const supportData=[];
  const supportSpacing=10.5;
  const nearbyLowerTrack=(x,z,top,ownDistance)=> {
    for(let k=0;k<samples.length;k+=3) {
      const sample=samples[k],sampleDistance=k/(samples.length-1)*length;
      let along=Math.abs(sampleDistance-ownDistance);along=Math.min(along,length-along);
      if(along<20)continue;
      if(sample.y<top-3 && Math.hypot(sample.x-x,sample.z-z)<3.2)return true;
    }
    return false;
  };
  for(let d=0;d<length;d+=supportSpacing) {
    const f=getFrame(d),top=f.position.clone().addScaledVector(f.up,-1.13);
    if(nearbyLowerTrack(top.x,top.z,top.y,d))continue;
    const span=top.y>28?3.6:2.7;
    // Leaning side braces read as lightweight tubular steel instead of heavy scaffolding.
    const side=new THREE.Vector3(f.right.x,0,f.right.z).normalize();
    const footA=top.clone().addScaledVector(side,span);footA.y=.20;
    const footB=top.clone().addScaledVector(side,-span);footB.y=.20;
    if(!nearbyLowerTrack(footA.x,footA.z,top.y,d))supportData.push({a:footA,b:top.clone(),foot:true});
    if(!nearbyLowerTrack(footB.x,footB.z,top.y,d))supportData.push({a:footB,b:top.clone(),foot:true});
    if(top.y>12) {
      const lower=top.clone();lower.y=top.y*.5;
      const braceA=footA.clone().lerp(top,.48),braceB=footB.clone().lerp(top,.48);
      supportData.push({a:braceA,b:braceB,foot:false});
    }
  }
  const supports=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.33,1,7),steelMat,supportData.length);
  supports.castShadow=true;supports.receiveShadow=true;root.add(supports);
  const basesData=supportData.filter(d=>d.foot);
  const bases=new THREE.InstancedMesh(new THREE.CylinderGeometry(.73,.92,.48,6),concreteMat,basesData.length);
  bases.receiveShadow=true;root.add(bases);
  const collars=new THREE.InstancedMesh(new THREE.CylinderGeometry(.39,.39,.46,7),tealMat,basesData.length);
  collars.castShadow=true;root.add(collars);
  supportData.forEach((d,i)=>supports.setMatrixAt(i,beamMatrix(d.a,d.b)));
  basesData.forEach((d,i)=> {
    object.position.copy(d.a);object.position.y=.22;object.quaternion.identity();object.scale.set(1,1,1);object.updateMatrix();bases.setMatrixAt(i,object.matrix);
    object.position.copy(d.a).lerp(d.b,.04);object.updateMatrix();collars.setMatrixAt(i,object.matrix);
  });

  function mesh(geometry,material,position,rotation=null) {
    const m=new THREE.Mesh(geometry,material);m.position.set(...position);if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }
  const boxBatches=new Map();
  function box(size,material,pos,rot=null) {
    if(!boxBatches.has(material))boxBatches.set(material,[]);
    object.position.set(...pos);object.rotation.set(...(rot||[0,0,0]));object.scale.set(...size);object.updateMatrix();
    boxBatches.get(material).push(object.matrix.clone());
  }
  // Open-sided boarding pavilion, set beside the track so the front view stays clear.
  const stationCream=mat(0xf8eed4), roofMat=mat(0xcb654a), darkMat=mat(0x244d4c), woodMat=mat(0xbd9367,{roughness:.85,metalness:0});
  box([31,5.6,9.4],stationCream,[-47,2.8,71.4]);
  box([31.5,.30,10],woodMat,[-47,5.75,71.2]);
  box([31,.22,1.25],tealMat,[-47,5.96,66.8]);
  for(let x=-61;x<=-33;x+=7) {
    box([.38,7.35,.38],tealMat,[x,9.6,76.0]);
    box([.32,7.35,.32],tealMat,[x,9.6,66.8]);
    box([.4,5.5,.4],darkMat,[x,2.75,75.8]);
  }
  box([32,.35,11.6],roofMat,[-47,13.35,71.3]);
  box([32,.55,.22],stationCream,[-47,13.1,65.55]);
  box([32,.55,.22],stationCream,[-47,13.1,77.05]);
  // Subtle raised canopy fins and individual deck seams make the station feel built.
  for(let x=-62;x<=-32;x+=2)box([.11,.16,11.6],stationCream,[x,13.59,71.3]);
  for(let x=-61;x<=-33;x+=1.0)box([.04,.025,8.8],stationCream,[x,5.915,71.3]);
  for(let x=-61;x<=-33;x+=2.25) {
    box([.13,1.2,.13],tealMat,[x,6.7,76.1]);
    box([2.25,.12,.13],tealMat,[x+1.1,7.24,76.1]);
  }
  // Platform stairs and handrails.
  for(let i=0;i<12;i++) box([6,(12-i)*.47,1.1],stationCream,[-47,(12-i)*.47/2,77.1+i*.75]);
  const handrailMaterial=tealMat;
  for(const x of [-50.1,-43.9]) {
    const a=new THREE.Vector3(x,6.9,77),b=new THREE.Vector3(x,1.1,86);
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,1,6),handrailMaterial);rail.matrix.copy(beamMatrix(a,b));rail.matrixAutoUpdate=false;root.add(rail);
  }
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f7ecd2';ctx.fillRect(0,0,1024,192);
    ctx.fillStyle='#275956';ctx.font='900 96px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('SUNCOAST',512,102);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(12.4,2.32),new THREE.MeshStandardMaterial({map:texture,roughness:.8,side:THREE.DoubleSide}));sign.position.set(-47,12.1,77.13);root.add(sign);
  }
  // A chain-lift spine hints at the mechanical climb, with safety handrails on its right.
  const distanceOf = p => {
    let best=Infinity,bestD=0;
    for(let i=0;i<samples.length;i++) {const d=samples[i].distanceToSquared(p);if(d<best){best=d;bestD=i/(samples.length-1)*length;}}
    return bestD;
  };
  const stationEnd=distanceOf(points[2]);
  const crest=distanceOf(points[5]);
  const dropEnd=distanceOf(points[8]);
  const tunnelStart=distanceOf(points[13]);
  const tunnelEnd=distanceOf(points[16]);
  const coastStart=distanceOf(points[20]);
  const cruiseStart=distanceOf(points[26]);
  const sections=[
    {start:0,end:stationEnd,name:'Boardwalk station',type:'station'},
    {start:stationEnd,end:crest,name:'The sky climb',type:'lift'},
    {start:crest,end:dropEnd,name:'Sunshine drop',type:'drop'},
    {start:dropEnd,end:tunnelStart,name:'Canyon curves',type:'turn'},
    {start:tunnelStart,end:tunnelEnd,name:'Palm ridge',type:'turn'},
    {start:tunnelEnd,end:coastStart,name:'Lagoon flyby',type:'cruise'},
    {start:coastStart,end:cruiseStart,name:'Coastal sweep',type:'turn'},
    {start:cruiseStart,end:length,name:'Homeward glide',type:'cruise'}
  ];
  const chainCount=Math.ceil((crest-stationEnd)/1.7);
  const chain=new THREE.InstancedMesh(new THREE.BoxGeometry(.29,.19,.65),darkMat,chainCount);
  const walkway=new THREE.InstancedMesh(new THREE.BoxGeometry(.9,.12,1.7),steelMat,chainCount);
  const safety=new THREE.InstancedMesh(new THREE.CylinderGeometry(.046,.046,1.05,5),steelMat,Math.ceil(chainCount/2));
  root.add(chain,walkway,safety);let safetyIndex=0;
  for(let i=0;i<chainCount;i++) {
    const f=getFrame(stationEnd+(i+.5)/chainCount*(crest-stationEnd));
    object.position.copy(f.position).addScaledVector(f.up,.08);object.quaternion.copy(f.quaternion);object.scale.set(1,1,1);object.updateMatrix();chain.setMatrixAt(i,object.matrix);
    object.position.copy(f.position).addScaledVector(f.right,2.15).addScaledVector(f.up,-.2);object.updateMatrix();walkway.setMatrixAt(i,object.matrix);
    if(i%2===0){object.position.addScaledVector(f.right,.4).addScaledVector(f.up,.52);object.updateMatrix();safety.setMatrixAt(safetyIndex++,object.matrix);}
  }
  // Curved handrail follows the lift without more per-object meshes.
  const handrailPoints=[];
  for(let i=0;i<=160;i++){const f=getFrame(stationEnd+i/160*(crest-stationEnd));handrailPoints.push(f.position.addScaledVector(f.right,2.55).addScaledVector(f.up,.85));}
  const handrailCurve=new THREE.CatmullRomCurve3(handrailPoints);
  const handrail=new THREE.Mesh(new THREE.TubeGeometry(handrailCurve,180,.045,5,false),steelMat);root.add(handrail);
  for(const [material,matrices] of boxBatches) {
    const batch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,matrices.length);
    matrices.forEach((matrix,index)=>batch.setMatrixAt(index,matrix));batch.castShadow=true;batch.receiveShadow=true;root.add(batch);
  }
  root.userData.trackLength=length;
  return {curve,length,samples,getFrame,sections};
}
