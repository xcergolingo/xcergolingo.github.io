import assert from 'node:assert/strict';
import * as THREE from './src/vendor/three.module.js';
import {createRoadster} from './src/createRoadster.js';
import {createTeslaRoadsterRocket} from './src/model-integration.js';
import {createCaliforniaPalm} from './src/palm-replacement.js';
function triangles(root,skipPlumes=false){let total=0;root.traverse(object=>{if(!object.isMesh)return;if(skipPlumes){for(let p=object;p;p=p.parent)if(p.name.startsWith('gas-from-'))return;}total+=(object.geometry.index?object.geometry.index.count:object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);});return total;}
function physicalBounds(root){const box=new THREE.Box3();root.updateMatrixWorld(true);root.traverse(object=>{if(!object.isMesh||object.isInstancedMesh)return;for(let p=object;p;p=p.parent)if(p.name.startsWith('gas-from-'))return;const positions=object.geometry.attributes.position;const point=new THREE.Vector3();for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);box.expandByPoint(point);}});return box;}
const source=createRoadster(),car=createTeslaRoadsterRocket(THREE,{groundY:.42}),unbatched=createTeslaRoadsterRocket(THREE,{groundY:.42,batchGeometry:false});
car.position.y=unbatched.position.y=.42;
assert.equal(triangles(source),167474);
assert.equal(triangles(car,true),triangles(source));
assert.equal(car.userData.optimization.originalDrawObjects,281);
assert.equal(car.userData.optimization.batchedDrawObjects,63);
const b=physicalBounds(car),u=physicalBounds(unbatched);
for(const key of ['min','max'])for(const axis of ['x','y','z'])assert(Math.abs(b[key][axis]-u[key][axis])<1e-6,`Batched bounds changed ${key}.${axis}`);
assert(Math.abs(b.min.y-.025)<1e-6);
assert.equal(car.userData.rearPlumes.length,4);
assert.equal(car.userData.cornerPlumes.length,0);
assert.equal(car.userData.dimensions.z>4.68,true);
car.userData.roll(.37);assert(Math.abs(car.userData.wheels[0].rotation.x-1)<1e-8);
car.userData.setSteering(.2);assert(car.userData.steering.every(m=>Math.abs(m.rotation.y+.2)<1e-8));
car.userData.updateThrusters(true,false,1);assert(car.userData.rearPlumes.every(p=>p.visible));
for(const plume of car.userData.rearPlumes){const a=plume.localToWorld(new THREE.Vector3(0,0,0)),b=plume.localToWorld(new THREE.Vector3(0,0,-1));assert(b.z>a.z,'Rear gas must travel behind the -Z-forward car');}
car.userData.resetVisuals();assert(car.userData.rearPlumes.every(p=>!p.visible));assert.equal(car.userData.wheels[0].rotation.x,0);
car.userData.setPaint(0x2255aa);assert.equal(car.userData.sourceModel.userData.materials.paint.color.getHex(),0x2255aa);
const palm=createCaliforniaPalm(THREE,1);assert.equal(palm.children.length,2);assert(physicalBounds(palm).max.y>10);
console.log(JSON.stringify({pass:true,sourceTriangles:triangles(source),optimized:car.userData.optimization,dimensions:car.userData.dimensions,tireY:b.min.y,palmMeshes:palm.children.length}));
source.userData.dispose();car.userData.dispose();unbatched.userData.dispose();
