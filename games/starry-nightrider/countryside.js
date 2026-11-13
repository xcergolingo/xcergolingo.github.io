// Reference-led countryside: broad brush-painted fields and tall sunflowers.
// Flat field surfaces sit below the roads; plants are clipped away from lanes.
export function createCountryside(THREE,{isMobile=false,clearOfRoad,colliders=[]}={}){
  const group=new THREE.Group();group.name='Sunflower countryside';
  const rand=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
  const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
  g.fillStyle='#d9c884';g.fillRect(0,0,512,512);
  // Directional strokes, not tiny noise: these remain legible at riding speed.
  for(let i=0;i<1250;i++){
    const x=rand(i+12)*512,y=rand(i+907)*512,len=7+rand(i+51)*35;
    g.strokeStyle=['#f9e0a2','#b59652','#e4cb77','#fff0b3','#95834f'][i%5];
    g.lineWidth=1+rand(i+83)*3;g.globalAlpha=.22+rand(i+75)*.35;
    g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len*.4,y-2,x+len,y-4);g.stroke();
  }
  g.globalAlpha=1;
  const brush=new THREE.CanvasTexture(c);brush.colorSpace=THREE.SRGBColorSpace;
  brush.wrapS=brush.wrapT=THREE.RepeatWrapping;brush.anisotropy=isMobile?2:4;
  const fieldMat=new THREE.MeshStandardMaterial({map:brush,vertexColors:true,roughness:1,metalness:0});
  const patches=[
    {x:38,z:98,w:49,d:70,a:-.13,gold:true},
    {x:-48,z:144,w:67,d:62,a:.08,gold:true},
    {x:107,z:52,w:48,d:66,a:-.12,gold:false},
    {x:128,z:154,w:71,d:66,a:.21,gold:true},
    {x:-154,z:-105,w:78,d:72,a:.11,gold:true},
    {x:48,z:-120,w:86,d:66,a:-.18,gold:false},
    {x:-49,z:-176,w:73,d:67,a:.17,gold:true},
    {x:222,z:61,w:77,d:114,a:-.2,gold:true},
    {x:-217,z:83,w:79,d:100,a:.1,gold:false}
  ];
  const planting=[];
  for(let k=0;k<patches.length;k++){
    const p=patches[k],geo=new THREE.PlaneGeometry(p.w,p.d,24,24);geo.rotateX(-Math.PI/2);
    const pos=geo.attributes.position,uv=geo.attributes.uv,colors=[];
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),u=x/p.w,v=z/p.d;
      const wave=v*8+Math.sin(u*4+k)*.7;
      const band=Math.floor(wave+10)%4;
      const color=new THREE.Color(p.gold?
        [0xf6cf68,0xc9af57,0xe4bd58,0xb7aa62][band]:
        [0x7d9765,0xb1ac65,0x719474,0xd1bc72][band]);
      color.multiplyScalar(.87+rand(i+k*107)*.15);colors.push(color.r,color.g,color.b);
      // Bow the outer edges into organic cultivated plots; never raise lanes.
      pos.setY(i,-.025);
      if(Math.abs(u)>.47)pos.setX(i,x+Math.sin(v*11+k)*2.8);
      if(Math.abs(v)>.47)pos.setZ(i,z+Math.sin(u*9+k)*2.3);
      uv.setXY(i,(u+.5)*p.w/18,(v+.5)*p.d/18);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,fieldMat);m.position.set(p.x,0,p.z);m.rotation.y=p.a;
    m.name=p.gold?'Curved golden wheat field':'Olive-green painted field';group.add(m);
    const cosine=Math.cos(p.a),sine=Math.sin(p.a);
    const world=(x,z)=>({x:p.x+x*cosine+z*sine,z:p.z-x*sine+z*cosine});
    // Flowers line two edges in distinct rows, leaving the broad field visible.
    if(p.gold)for(let row=0;row<2;row++)for(let n=0;n<23;n++){
      const t=n/22-.5;const v=world(-p.w*.44+row*2.6,t*p.d*.92);
      planting.push({...v,seed:k*201+row*59+n});
    }
  }
  // A near roadside row makes the recognizable reference flowers visible early.
  for(let i=0;i<27;i++)planting.push({x:12.2+Math.sin(i*.3)*1.4,z:72+i*2.7,seed:1900+i});
  for(let i=0;i<20;i++)planting.push({x:-12.5-Math.sin(i*.27)*1.6,z:122+i*3.5,seed:2100+i});
  const clear=(x,z,margin=6.1)=>clearOfRoad(x,z,margin)&&!colliders.some(b=>Math.abs(x-b.x)<b.rx+1.2&&Math.abs(z-b.z)<b.rz+1.2);
  const plants=planting.filter(p=>clear(p.x,p.z));
  const petalData=[],petalUV=[];
  for(let p=0;p<13;p++){
    const a=p/13*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
    const pts=[[.18,-.035],[.39,-.11],[.69,0],[.39,.11]];
    for(const j of [0,1,2,0,2,3]){
      const [r,t]=pts[j];petalData.push(ca*r-sa*t,sa*r+ca*t,.012);
      petalUV.push(r/.69,.5+t/.22);
    }
  }
  const petalGeo=new THREE.BufferGeometry();petalGeo.setAttribute('position',new THREE.Float32BufferAttribute(petalData,3));
  petalGeo.setAttribute('uv',new THREE.Float32BufferAttribute(petalUV,2));petalGeo.computeVertexNormals();
  const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,0,.22,.25,.05,.03,.68,0,0,0,0,.03,.68,0,-.24,.31,.05],3));leafGeo.computeVertexNormals();
  const stemMat=new THREE.MeshStandardMaterial({color:0x405e3c,roughness:1});
  const petalMat=new THREE.MeshStandardMaterial({color:0xffcf31,emissive:0x7c4c02,emissiveIntensity:.12,side:THREE.DoubleSide,roughness:1});
  const seedMat=new THREE.MeshStandardMaterial({color:0x36252a,roughness:1});
  const seedDotMat=new THREE.MeshStandardMaterial({color:0xc58b35,roughness:1});
  const leafMat=new THREE.MeshStandardMaterial({color:0x638652,side:THREE.DoubleSide,roughness:1});
  const chunks=new Map();
  for(const p of plants){const key=Math.floor(p.x/80)+','+Math.floor(p.z/80);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
  const stemGeo=new THREE.CylinderGeometry(.025,.045,1,5);
  const centerGeo=new THREE.SphereGeometry(.255,10,6);centerGeo.scale(1,1,.3);
  const seedGeo=new THREE.TorusGeometry(.195,.024,3,12);
  for(const chunk of chunks.values()){
    const stems=new THREE.InstancedMesh(stemGeo,stemMat,chunk.length);
    const petals=new THREE.InstancedMesh(petalGeo,petalMat,chunk.length);
    const centers=new THREE.InstancedMesh(centerGeo,seedMat,chunk.length);
    const seeds=new THREE.InstancedMesh(seedGeo,seedDotMat,chunk.length);
    const leaves=new THREE.InstancedMesh(leafGeo,leafMat,chunk.length*3);
    for(let i=0;i<chunk.length;i++){
      const p=chunk[i],h=2.9+rand(p.seed+65)*1.35,scale=.8+rand(p.seed+14)*.32;
      dummy.position.set(p.x,h*.5,p.z);dummy.rotation.set(.035,0,-.07+rand(p.seed)*.14);dummy.scale.set(1,h,1);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
      const yaw=(rand(p.seed+36)-.5)*1.7;
      dummy.position.set(p.x,h,p.z);dummy.rotation.set(-.16,yaw,(rand(p.seed+24)-.5)*.5);dummy.scale.setScalar(scale);dummy.updateMatrix();
      petals.setMatrixAt(i,dummy.matrix);centers.setMatrixAt(i,dummy.matrix);
      dummy.translateZ(.085);dummy.updateMatrix();seeds.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<3;j++){
        dummy.position.set(p.x,h*(.27+j*.19),p.z);dummy.rotation.set(.3,yaw+j*2.3,(j%2?1:-1)*.92);dummy.scale.setScalar(.8+j*.12);dummy.updateMatrix();leaves.setMatrixAt(i*3+j,dummy.matrix);
      }
    }
    for(const inst of [stems,petals,centers,seeds,leaves]){inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();group.add(inst);}
  }
  // Tiny wheat strokes are instanced. Their pale tips catch the moonlight.
  const wheatPos=[];
  for(let k=0;k<patches.length;k++)if(patches[k].gold){const p=patches[k];
    for(let n=0;n<(isMobile?150:230);n++){
      const x=p.x+(rand(k*509+n+99)-.5)*p.w*.92,z=p.z+(rand(k*803+n+479)-.5)*p.d*.92;
      if(clear(x,z,6.2))wheatPos.push({x,z,s:rand(n+k*87)});
    }
  }
  const bladeGeo=new THREE.BufferGeometry();bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.06,0,0,.05,0,0,.025,.64,0,0,0,-.05,0,0,.05,0,.53,.02],3));bladeGeo.computeVertexNormals();
  const wheat=new THREE.InstancedMesh(bladeGeo,new THREE.MeshStandardMaterial({color:0xebca76,side:THREE.DoubleSide,roughness:1}),wheatPos.length);
  wheatPos.forEach((p,i)=>{dummy.position.set(p.x,.005,p.z);dummy.rotation.set(0,p.s*6.28,.12);dummy.scale.setScalar(.7+p.s*.9);dummy.updateMatrix();wheat.setMatrixAt(i,dummy.matrix);});
  wheat.instanceMatrix.needsUpdate=true;wheat.computeBoundingSphere();group.add(wheat);
  group.userData={fieldCount:patches.length,sunflowerCount:plants.length,wheatCount:wheatPos.length};
  return group;
}
