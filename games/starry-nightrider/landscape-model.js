// Continuous moonlit hills. The old skyline was a ring of low-sided spheres;
// these three indexed surfaces have broad, connected ridgelines and smooth
// normals instead. No per-frame work, image download or extra lights needed.
export function createLandscape(THREE,{isMobile=false}={}){
  const group=new THREE.Group();group.name='Smooth moonlit countryside ridges';
  const TAU=Math.PI*2;
  const around=isMobile?192:256,across=isMobile?15:20;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const layers=[
    {name:'Rolling teal foothills',offset:0,depth:116,height:25,phase:.55,
      foot:0x203f48,crest:0x3c616a,emissive:0x142d39},
    {name:'Continuous cobalt ridge',offset:42,depth:132,height:43,phase:1.6,
      foot:0x273d61,crest:0x496b8b,emissive:0x192e49},
    {name:'Distant blue mountain silhouette',offset:90,depth:145,height:60,phase:2.7,
      foot:0x364a72,crest:0x5b7396,emissive:0x253852}
  ];
  // A rounded-square footprint encloses the entire playable ±268 m square.
  // It avoids both sharp diagonal corners and hills intruding into its lanes.
  const innerRadius=angle=>295/Math.pow(
    Math.pow(Math.abs(Math.cos(angle)),14)+Math.pow(Math.abs(Math.sin(angle)),14),1/14);
  const vector=new THREE.Vector3();
  for(let layerIndex=0;layerIndex<layers.length;layerIndex++){
    const spec=layers[layerIndex],positions=[],colors=[],indices=[];
    const foot=new THREE.Color(spec.foot),crest=new THREE.Color(spec.crest);
    const color=new THREE.Color();
    for(let row=0;row<=across;row++){
      const t=row/across;
      for(let column=0;column<=around;column++){
        const angle=column/around*TAU,phase=spec.phase;
        const summitAt=.53+.075*Math.sin(angle*2+phase);
        const ascent=t<summitAt?t/summitAt:(1-t)/(1-summitAt);
        // Zero slope at the foot and the crest: a gentle hillside, not a cone.
        const profile=Math.pow(Math.sin(clamp(ascent,0,1)*Math.PI*.5),1.85);
        const ridge=1+.12*Math.sin(angle*2+phase)+.17*Math.cos(angle*4-phase*.6)
          +.13*Math.sin(angle*7+phase*.8)+.07*Math.cos(angle*10-phase)
          +.035*Math.sin(angle*13+phase*.4);
        const broadSwell=4.5*Math.sin(angle*3+phase)+2.6*Math.cos(angle*5-phase);
        const radius=innerRadius(angle)+spec.offset+t*spec.depth+broadSwell*Math.sin(Math.PI*t);
        const height=-.16+spec.height*ridge*profile;
        positions.push(Math.cos(angle)*radius,height,Math.sin(angle)*radius);
        // Restrained, continuous painted bands follow the slope. There are no
        // random vertex colors, hard band steps or contrasting polygon facets.
        const contour=Math.sin(t*TAU*2.15+Math.sin(angle*3+phase)*.6);
        const sunward=.5+.5*Math.cos(angle+1.05);
        const tint=clamp(.13+profile*.63+sunward*.1+contour*.045,0,1);
        color.copy(foot).lerp(crest,tint);
        colors.push(color.r,color.g,color.b);
      }
    }
    for(let row=0;row<across;row++)for(let column=0;column<around;column++){
      const a=row*(around+1)+column,b=a+1,c=a+around+1,d=c+1;
      indices.push(a,b,c,b,d,c);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    // The repeated angular endpoint makes a topological seam. Average its
    // normals explicitly so it remains invisible under directional moonlight.
    const normals=geometry.attributes.normal;
    for(let row=0;row<=across;row++){
      const first=row*(around+1),last=first+around;
      vector.set(normals.getX(first)+normals.getX(last),
        normals.getY(first)+normals.getY(last),normals.getZ(first)+normals.getZ(last)).normalize();
      normals.setXYZ(first,vector.x,vector.y,vector.z);normals.setXYZ(last,vector.x,vector.y,vector.z);
    }
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,
      roughness:1,metalness:0,flatShading:false,emissive:spec.emissive,emissiveIntensity:.1});
    const ridgeMesh=new THREE.Mesh(geometry,material);ridgeMesh.name=spec.name;
    ridgeMesh.userData={landscapeLayer:layerIndex,smoothRidge:true};
    group.add(ridgeMesh);
  }
  group.userData={ridgeCount:layers.length,triangles:layers.length*around*across*2,
    playableHalfWidth:268,innerAxisRadius:295,smoothNormals:true};
  return group;
}
