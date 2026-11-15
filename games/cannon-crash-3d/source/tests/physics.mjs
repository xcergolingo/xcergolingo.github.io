import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import {LEVELS} from '../src/levels.js';
import {createStage,buildCannon,PLATFORM} from '../src/world.js';

// This deterministic smoke test runs physics in Node without requiring WebGL.
const world=new CANNON.World({gravity:new CANNON.Vec3(0,-14,0),allowSleep:true});
world.solver.iterations=14;
world.defaultContactMaterial.friction=.16;
world.defaultContactMaterial.restitution=.2;
const scene=new THREE.Scene();const cannon=buildCannon(scene);
for(let index=0;index<LEVELS.length;index++){
  const stage=createStage(scene,world,LEVELS[index],index,()=>{});
  for(let i=0;i<100;i++){stage.beforeStep(1/60,i/60);world.step(1/60);}
  const unstable=stage.targets.filter(t=>{
    const p=t.body.position,s=t.shelf;
    return p.y<s.y-.85||(Math.abs(p.x-s.x)>s.width/2+.55||Math.abs(p.z-s.z)>s.depth/2+.65)&&p.y<s.y+1.15;
  }).length;
  console.log(`Level ${index+1} setup: ${stage.targets.length} targets, ${stage.platforms.length} decks, ${stage.hazards.length} moving bumpers, ${unstable} premature falls`);
  stage.dispose();
  if(unstable){console.error('Unexpected pre-shot collapse');process.exitCode=1;}
}
const cases=[
  {level:0,shelf:0,aimX:0},{level:1,shelf:0,aimX:0},
  {level:2,shelf:1,aimX:0},{level:5,shelf:0,aimX:0},
  {level:6,shelf:2,aimX:1.45},{level:8,shelf:0,aimX:0},
  {level:9,shelf:2,aimX:1.6}
];
for(const tc of cases){
  const level=LEVELS[tc.level],stage=createStage(scene,world,level,tc.level,()=>{});
  for(let i=0;i<60;i++){stage.beforeStep(1/60,i/60);world.step(1/60);}
  const deck=stage.platforms[tc.shelf];
  const target=new THREE.Vector3(tc.aimX,deck.y+.48,deck.z),flight=.94;
  let start=new THREE.Vector3(),velocity=new THREE.Vector3();
  for(let k=0;k<3;k++){
    cannon.muzzlePoint.updateWorldMatrix(true,false);cannon.muzzlePoint.getWorldPosition(start);
    velocity.copy(target).sub(start).divideScalar(flight);velocity.y+=.5*14*flight;
    cannon.aim(-Math.atan2(velocity.x,-velocity.z),Math.atan2(velocity.y,Math.hypot(velocity.x,velocity.z)));
  }
  cannon.muzzlePoint.updateWorldMatrix(true,false);cannon.muzzlePoint.getWorldPosition(start);
  velocity.copy(target).sub(start).divideScalar(flight);velocity.y+=.5*14*flight;
  const balls=[];
  for(let f=0;f<480;f++){
    if(f%3===0&&f<57){
      const body=new CANNON.Body({mass:2.05,shape:new CANNON.Sphere(.235)});
      body.position.set(start.x,start.y,start.z);body.velocity.set(velocity.x+(f%15-6)*.035,velocity.y,velocity.z);
      body.isProjectile=true;world.addBody(body);balls.push(body);
    }
    stage.beforeStep(1/60,f/60+1);
    world.step(1/60);
  }
  const fallen=stage.targets.filter(t=>t.shelf===deck&&(()=>{
    const p=t.body.position;
    return p.y<deck.y-.85||Math.abs(p.x-deck.x)>deck.width/2+.55||Math.abs(p.z-deck.z)>deck.depth/2+.65;
  })()).length;
  console.log(`Level ${tc.level+1}, shelf ${tc.shelf}: ${fallen} targets knocked down by 19-ball salvo (launch vy=${velocity.y.toFixed(1)})`);
  for(const b of balls)world.removeBody(b);
  stage.dispose();
  if(fallen===0){console.error('Physics smoke test failed: no target knocked down');process.exitCode=1;}
}
