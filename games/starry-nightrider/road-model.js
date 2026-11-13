// A single, smooth paving material across all lanes and the village square.
// UVs are world-space: overlapping junctions sample exactly the same texels.
export function createRoadNetwork(THREE,{material,tileSize=8}={}){
  const paths=[];
  const up=new THREE.Vector3(0,1,0);
  function addRoad(points,width,closed=false){paths.push({points,width,closed});}
  function build(){
    const group=new THREE.Group();group.name='Seamless village road network';
    const positions=[],uvs=[],indices=[],edges=[],edgeColors=[],edgeIndices=[];
    const shoulderColor=new THREE.Color(0xb2a294),cellSize=24,cells=new Map();
    const segments=[];
    paths.forEach((path,id)=>{
      for(let i=1;i<path.points.length;i++){
        const a=path.points[i-1],b=path.points[i],r=path.width*.5;
        const seg={id,a,b,r,dx:b.x-a.x,dz:b.z-a.z};
        seg.length2=seg.dx*seg.dx+seg.dz*seg.dz;
        const index=segments.push(seg)-1;
        for(let x=Math.floor((Math.min(a.x,b.x)-r)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+r)/cellSize);x++)
          for(let z=Math.floor((Math.min(a.z,b.z)-r)/cellSize);z<=Math.floor((Math.max(a.z,b.z)+r)/cellSize);z++){
            const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(index);
          }
      }
    });
    function insideOtherRoad(x,z,id){
      if(x*x+z*z<21.6*21.6)return true;
      for(const n of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[]){
        const s=segments[n];if(s.id===id)continue;
        const t=Math.max(0,Math.min(1,((x-s.a.x)*s.dx+(z-s.a.z)*s.dz)/(s.length2||1)));
        const dx=x-s.a.x-s.dx*t,dz=z-s.a.z-s.dz*t;
        if(dx*dx+dz*dz<(s.r+.25)*(s.r+.25))return true;
      }
      return false;
    }
    function vertex(x,z){positions.push(x,.047,z);uvs.push(x/tileSize,z/tileSize);}
    function disc(x,z,r){
      const base=positions.length/3;vertex(x,z);
      for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;vertex(x+Math.cos(a)*r,z+Math.sin(a)*r);}
      for(let i=1;i<=64;i++)indices.push(base,base+i+1,base+i);
    }
    function shoulder(a,b,normalA,normalB,side,id){
      // No raised curb crosses another lane. At a junction the road is open.
      const x=(a.x+b.x)*.5,z=(a.z+b.z)*.5;
      if(insideOtherRoad(x,z,id))return;
      const base=edges.length/3;
      for(const [p,n] of [[a,normalA],[b,normalB]])for(const outer of [false,true]){
        const offset=outer?.85:-.025;
        edges.push(p.x+n.x*offset*side,.041,p.z+n.z*offset*side);
        edgeColors.push(shoulderColor.r,shoulderColor.g,shoulderColor.b,outer?0:.48);
      }
      edgeIndices.push(base,base+1,base+2,base+1,base+3,base+2);
    }
    paths.forEach(({points,width,closed},id)=>{
      const count=points.length,base=positions.length/3,left=[],right=[],normals=[];
      for(let i=0;i<count;i++){
        const previous=points[i===0?(closed?count-2:0):i-1];
        const next=points[i===count-1?(closed?1:count-1):i+1];
        const tangent=next.clone().sub(previous).normalize();
        const normal=new THREE.Vector3().crossVectors(tangent,up).normalize();
        const l=points[i].clone().addScaledVector(normal,width*.5);
        const r=points[i].clone().addScaledVector(normal,-width*.5);
        left.push(l);right.push(r);normals.push(normal);vertex(l.x,l.z);vertex(r.x,r.z);
        if(i){const n=base+i*2;indices.push(n-2,n,n-1,n-1,n,n+1);}
      }
      for(let i=1;i<count;i++){
        shoulder(left[i-1],left[i],normals[i-1],normals[i],1,id);
        shoulder(right[i-1],right[i],normals[i-1],normals[i],-1,id);
      }
      if(!closed){disc(points[0].x,points[0].z,width*.5);disc(points[count-1].x,points[count-1].z,width*.5);}
    });
    // Plaza shares the same height, stone size, orientation and material.
    disc(0,0,21);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const road=new THREE.Mesh(geometry,material);road.name='Continuous world-UV paving';road.receiveShadow=true;
    group.add(road);
    const border=new THREE.BufferGeometry();
    border.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
    border.setAttribute('color',new THREE.Float32BufferAttribute(edgeColors,4));
    border.setIndex(edgeIndices);border.computeVertexNormals();border.computeBoundingSphere();
    const shoulders=new THREE.Mesh(border,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1}));
    shoulders.name='Soft open-junction road edges';group.add(shoulders);
    group.userData={roadCount:paths.length,tileSize,consistentWorldUV:true,raisedIntersectionCurbs:false};
    return group;
  }
  return{addRoad,build};
}
