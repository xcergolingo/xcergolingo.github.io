import { createRoadster } from './createRoadster.js';

/** Adapter for the exact user-supplied procedural Roadster. Geometry is retained. */
export function createTeslaRoadsterRocket(THREE, options = {}) {
  const groundY = options.groundY ?? .42;
  const tireClearance = options.tireClearance ?? .025;
  const root = new THREE.Group();
  root.name = 'Roadster-Rush-player';
  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'Roadster-midheight-roll-pivot';
  root.add(bodyGroup);
  const model = createRoadster({color: options.color ?? 0xf5f5f1});
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  bodyGroup.position.y = tireClearance + size.y * .5 - groundY;
  model.rotation.y = Math.PI;
  model.position.set(center.x, -center.y, center.z);
  bodyGroup.add(model);
  const source = model.userData;
  const optimization = options.batchGeometry === false
    ? {originalDrawObjects: countMeshes(model), batchedDrawObjects: countMeshes(model)}
    : batchModel(THREE, model);
  source.materials.paint.envMapIntensity = 1.05;
  source.materials.glass.envMapIntensity = 1.0;

  const rearPlumes = [];
  const outerGeometry = plumeGeometry(THREE, .053, .19, 1.15);
  const innerGeometry = plumeGeometry(THREE, .024, .065, .68);
  const outerMaterial = new THREE.MeshBasicMaterial({color:0xc2ecff,transparent:true,opacity:.17,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const innerMaterial = new THREE.MeshBasicMaterial({color:0xf1fcff,transparent:true,opacity:.29,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  for (const nozzle of source.thrusters) {
    const plume = new THREE.Group();
    plume.name = 'gas-from-' + nozzle.name;
    plume.position.copy(nozzle.userData.emitter);
    plume.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),nozzle.userData.direction.clone().normalize());
    const outer = new THREE.Mesh(outerGeometry,outerMaterial);
    const inner = new THREE.Mesh(innerGeometry,innerMaterial);
    outer.renderOrder = inner.renderOrder = 3;
    plume.add(outer,inner);
    plume.visible = false;
    nozzle.add(plume);
    rearPlumes.push(plume);
  }
  const api = {
    bodyGroup, sourceModel:model, wheels:source.wheels, steering:source.steering,
    rearPlumes, cornerPlumes:[], dimensions:size.clone(), wheelRadius:.370, optimization,
    roll(distance) { source.roll(distance); },
    setSteering(radians) { source.setSteering(-radians); },
    setPaint(color) { source.setPaint(color); },
    setLights(on) { source.setLights(on); },
    updateThrusters(active, rolling = false, elapsed = 0) {
      rearPlumes.forEach((plume,i) => {
        plume.visible = !!(active || rolling);
        if (!plume.visible) return;
        const pulse = Math.sin(elapsed * 53 + i * 1.71) * .085 + Math.sin(elapsed * 89 + i * 2.31) * .045;
        plume.scale.set(1+pulse*.3,1+pulse*.3,(active?1:.65)+pulse);
      });
    },
    resetVisuals() {
      bodyGroup.rotation.set(0,0,0);
      source.setSteering(0);
      source.wheels.forEach(wheel => {wheel.rotation.x = 0;});
      rearPlumes.forEach(plume => {plume.visible = false;});
    },
    dispose() { source.dispose(); }
  };
  root.userData = {units:'metres',forward:'-Z',modelSource:'Roadster-Procedural-Source.zip / dist/src/createRoadster.js',groundY,tireClearance};
  // Animation references are deliberately not serializable, matching the source model.
  for (const [key,value] of Object.entries(api)) Object.defineProperty(root.userData,key,{value,enumerable:false});
  root.updateMatrixWorld(true);
  return root;
}

function plumeGeometry(THREE, startRadius, endRadius, length) {
  const points = [];
  for (let i=0;i<=12;i++) {
    const t=i/12;
    points.push(new THREE.Vector2(THREE.MathUtils.lerp(startRadius,endRadius,Math.pow(t,.7)),t*length));
  }
  const geometry = new THREE.LatheGeometry(points,12);
  geometry.rotateX(-Math.PI/2);
  return geometry;
}

function countMeshes(group) { let count=0;group.traverse(object=>{if(object.isMesh)count++;});return count; }

function batchModel(THREE, model) {
  const originalDrawObjects=countMeshes(model);
  const canonical=new Map(),orphans=new Set();
  model.traverse(object=>{
    if(!object.isMesh||Array.isArray(object.material))return;
    const material=object.material;
    const signature=JSON.stringify(material.toJSON(),(key,value)=>key==='uuid'||key==='metadata'?undefined:value);
    if(canonical.has(signature)&&canonical.get(signature)!==material){object.material=canonical.get(signature);orphans.add(material);}
    else canonical.set(signature,material);
  });
  for(const material of orphans)material.dispose();
  for(const key of ['body','glasshouse','frontFascia','rearFascia','trim','lighting'])mergeRigidMeshes(THREE,model.userData.parts[key]);
  for(const wheel of model.userData.wheels)mergeRigidMeshes(THREE,wheel);
  return {originalDrawObjects,batchedDrawObjects:countMeshes(model)};
}

/** Merge only rigid meshes; wheel pivots, drilled rotors and source normals remain intact. */
export function mergeStaticMeshes(THREE, group) {
  const originalDrawObjects=countMeshes(group);
  mergeRigidMeshes(THREE,group);
  return {originalDrawObjects,batchedDrawObjects:countMeshes(group)};
}

function mergeRigidMeshes(THREE, group) {
  group.updateWorldMatrix(true,true);
  const inverse=group.matrixWorld.clone().invert();
  const buckets=new Map();
  group.traverse(object=>{
    if(!object.isMesh||object.isInstancedMesh||object.isSkinnedMesh||Array.isArray(object.material)||object.geometry.morphAttributes.position||!object.visible)return;
    const key=[object.material.uuid,object.castShadow,object.receiveShadow,object.renderOrder].join('/');
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(object);
  });
  const removedGeometries=new Set();
  let sequence=0;
  for(const meshes of buckets.values()) {
    if(meshes.length<2)continue;
    const entries=[];
    let vertexCount=0,indexCount=0;
    for(const mesh of meshes) {
      const geometry=mesh.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
      if(!geometry.attributes.normal)geometry.computeVertexNormals();
      entries.push(geometry);
      vertexCount+=geometry.attributes.position.count;
      indexCount+=geometry.index?geometry.index.count:geometry.attributes.position.count;
    }
    const position=new Float32Array(vertexCount*3),normal=new Float32Array(vertexCount*3),uv=new Float32Array(vertexCount*2);
    const indices=vertexCount>65535?new Uint32Array(indexCount):new Uint16Array(indexCount);
    let vertexOffset=0,indexOffset=0;
    for(const geometry of entries) {
      const p=geometry.attributes.position,n=geometry.attributes.normal,t=geometry.attributes.uv;
      for(let i=0;i<p.count;i++) {
        const target=(vertexOffset+i)*3;
        position[target]=p.getX(i);position[target+1]=p.getY(i);position[target+2]=p.getZ(i);
        normal[target]=n.getX(i);normal[target+1]=n.getY(i);normal[target+2]=n.getZ(i);
        if(t){uv[(vertexOffset+i)*2]=t.getX(i);uv[(vertexOffset+i)*2+1]=t.getY(i);}
      }
      const count=geometry.index?geometry.index.count:p.count;
      for(let i=0;i<count;i++)indices[indexOffset+i]=vertexOffset+(geometry.index?geometry.index.getX(i):i);
      indexOffset+=count;vertexOffset+=p.count;geometry.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normal,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    geometry.setIndex(new THREE.BufferAttribute(indices,1));
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const first=meshes[0],batch=new THREE.Mesh(geometry,first.material);
    batch.name=group.name+'-rigid-batch-'+sequence++;
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;
    for(const mesh of meshes){removedGeometries.add(mesh.geometry);mesh.removeFromParent();}
    group.add(batch);
  }
  const retained=new Set();group.traverse(object=>{if(object.geometry)retained.add(object.geometry);});
  for(const geometry of removedGeometries)if(!retained.has(geometry))geometry.dispose();
}
