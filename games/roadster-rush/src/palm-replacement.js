/** A continuous, inward-curving trunk with connected fan fronds. Two meshes. */
export function createCaliforniaPalm(THREE, side = 1) {
  const group=new THREE.Group();group.name='California-fan-palm';
  const height=10.6+Math.random()*1.3;
  const lean=-Math.sign(side||1)*(1.15+Math.random()*.4);
  const zBend=(Math.random()-.5)*.55;
  const centerAt=t=>new THREE.Vector3(lean*t*t,height*t,zBend*t*t);
  const p=[],n=[],uv=[],idx=[];
  const rings=22,sides=8;
  for(let ring=0;ring<=rings;ring++) {
    const t=ring/rings,center=centerAt(t);
    const tangent=new THREE.Vector3(2*lean*t,height,2*zBend*t).normalize();
    const right=new THREE.Vector3().crossVectors(tangent,new THREE.Vector3(0,0,1)).normalize();
    const forward=new THREE.Vector3().crossVectors(right,tangent).normalize();
    const radius=(.22*(1-t)+.075*t)*(1+.055*Math.sin(ring*Math.PI));
    for(let j=0;j<=sides;j++) {
      const a=j/sides*Math.PI*2,normal=right.clone().multiplyScalar(Math.cos(a)).addScaledVector(forward,Math.sin(a));
      const point=center.clone().addScaledVector(normal,radius);
      p.push(point.x,point.y,point.z);n.push(normal.x,normal.y,normal.z);uv.push(j/sides,t);
      if(ring<rings&&j<sides){const k=ring*(sides+1)+j;idx.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
    }
  }
  const trunkGeometry=new THREE.BufferGeometry();
  trunkGeometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));trunkGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));trunkGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));trunkGeometry.setIndex(idx);
  const trunk=new THREE.Mesh(trunkGeometry,new THREE.MeshLambertMaterial({color:0x75523e}));
  trunk.castShadow=true;trunk.receiveShadow=true;group.add(trunk);
  const crown=centerAt(1),leafPositions=[],leafIndices=[];
  const fans=11;
  for(let f=0;f<fans;f++) {
    const angle=f/fans*Math.PI*2+(f%2?.12:0),length=2.6+(f%3)*.25;
    const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
    const across=new THREE.Vector3(-direction.z,0,direction.x);
    const start=leafPositions.length/3,segments=10;
    for(let j=0;j<=segments;j++) {
      const t=j/segments;
      const middle=crown.clone().addScaledVector(direction,length*t);
      middle.y+=Math.sin(t*Math.PI)*.78-t*t*1.10;
      const width=Math.sin(Math.PI*t)*(.34+(f%2)*.04);
      const serration=(j%2?1:.74);
      const left=middle.clone().addScaledVector(across,width*serration);
      const right=middle.clone().addScaledVector(across,-width*serration);
      middle.y+=Math.sin(t*Math.PI)*.075;
      leafPositions.push(left.x,left.y,left.z,middle.x,middle.y,middle.z,right.x,right.y,right.z);
      if(j<segments){const k=start+j*3;leafIndices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
    }
  }
  const leafGeometry=new THREE.BufferGeometry();leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));leafGeometry.setIndex(leafIndices);leafGeometry.computeVertexNormals();
  const leaves=new THREE.Mesh(leafGeometry,new THREE.MeshLambertMaterial({color:0x376d35,side:THREE.DoubleSide}));leaves.castShadow=true;group.add(leaves);
  return group;
}
