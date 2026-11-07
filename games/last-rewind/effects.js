import * as THREE from './vendor/three.module.js';

/** Fixed pools for muzzle-impact sparks, dust, and shell/health pickups. */
export function createEffects(scene){
  const count=160,positions=new Float32Array(count*3),colors=new Float32Array(count*3);
  const particles=Array.from({length:count},()=>({active:false,life:0,max:1,v:new THREE.Vector3()}));
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  positions.fill(-1000);
  const mat=new THREE.PointsMaterial({size:.043,vertexColors:true,transparent:true,opacity:.85,depthWrite:false,blending:THREE.AdditiveBlending});
  const dots=new THREE.Points(geo,mat);dots.frustumCulled=false;scene.add(dots);
  let cursor=0;
  const pickups=[];
  const ammoMat=new THREE.MeshStandardMaterial({color:0x765c37,roughness:.7,emissive:0x142014,emissiveIntensity:.25});
  const medicalMat=new THREE.MeshStandardMaterial({color:0x244837,roughness:.6,emissive:0x214d37,emissiveIntensity:.35});
  const crossMat=new THREE.MeshBasicMaterial({color:0xa8deaf});
  const brassMat=new THREE.MeshStandardMaterial({color:0xcbb273,metalness:.6,roughness:.3});
  const redMat=new THREE.MeshStandardMaterial({color:0xa22c25,roughness:.6});
  const ringGeo=new THREE.RingGeometry(.32,.36,24);
  for(let i=0;i<14;i++){
    const root=new THREE.Group();root.visible=false;
    const box=new THREE.Mesh(new THREE.BoxGeometry(.42,.21,.3),ammoMat);box.position.y=.18;root.add(box);
    const cross1=new THREE.Mesh(new THREE.BoxGeometry(.19,.012,.05),crossMat);cross1.position.y=.29;root.add(cross1);
    const cross2=new THREE.Mesh(new THREE.BoxGeometry(.05,.012,.19),crossMat);cross2.position.y=.29;root.add(cross2);
    const shells=new THREE.Group();
    for(let j=0;j<3;j++){
      const s=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.19,6),redMat);s.position.set((j-1)*.1,.35,0);s.rotation.z=Math.PI/2;shells.add(s);
      const b=new THREE.Mesh(new THREE.CylinderGeometry(.036,.036,.035,6),brassMat);b.position.set((j-1)*.1+.08,.35,0);b.rotation.z=Math.PI/2;shells.add(b);
    }root.add(shells);
    const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0xb1d6a1,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.025;root.add(ring);
    scene.add(root);pickups.push({root,box,cross1,cross2,shells,ring,active:false,kind:'ammo',life:0});
  }
  function burst(point,color=0xffc784,n=8){
    const c=new THREE.Color(color);
    for(let i=0;i<n;i++){
      const idx=cursor++%count,p=particles[idx];p.active=true;p.life=p.max=.18+Math.random()*.25;
      p.v.set((Math.random()-.5)*3,Math.random()*2.3,(Math.random()-.5)*3);
      positions[idx*3]=point.x;positions[idx*3+1]=point.y;positions[idx*3+2]=point.z;
      colors[idx*3]=c.r;colors[idx*3+1]=c.g;colors[idx*3+2]=c.b;
    }
    geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
  }
  function drop(position,kind='ammo'){
    const p=pickups.find(p=>!p.active)||pickups[0];p.active=true;p.life=45;p.kind=kind;p.root.visible=true;p.root.position.set(position.x,0,position.z);
    p.box.material=kind==='health'?medicalMat:ammoMat;p.cross1.visible=p.cross2.visible=kind==='health';p.shells.visible=kind==='ammo';
  }
  function update(dt,t,player,onPickup){
    for(let i=0;i<count;i++){
      const p=particles[i];if(!p.active)continue;
      p.life-=dt;if(p.life<=0){p.active=false;positions[i*3+1]=-1000;continue;}
      p.v.y-=dt*5;positions[i*3]+=p.v.x*dt;positions[i*3+1]+=p.v.y*dt;positions[i*3+2]+=p.v.z*dt;
    }geo.attributes.position.needsUpdate=true;
    for(const p of pickups){if(!p.active)continue;p.life-=dt;p.box.position.y=.2+Math.sin(t*3)*.04;p.root.rotation.y+=dt*.35;p.ring.material.opacity=.35+Math.sin(t*3)*.15;
      if(player&&Math.hypot(player.x-p.root.position.x,player.z-p.root.position.z)<1.15){onPickup?.(p.kind);p.active=false;p.root.visible=false;}
      else if(p.life<=0){p.active=false;p.root.visible=false;}
    }
  }
  function reset(){for(const p of pickups){p.active=false;p.root.visible=false;}for(const p of particles)p.active=false;positions.fill(-1000);geo.attributes.position.needsUpdate=true;}
  return {burst,drop,update,reset,pickups};
}
