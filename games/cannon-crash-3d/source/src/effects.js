import * as THREE from 'three';

const PALETTE=['#fff6a5','#f9889c','#93faff','#ffffff','#b2f58b','#ffc481','#c6b5ff'];

// A single Points draw call powers all impact sparks, dust and victory confetti.
export class Effects {
  constructor(scene,camera){
    this.camera=camera;this.pool=[];this.capacity=540;this.cursor=0;
    const positions=new Float32Array(this.capacity*3),colors=new Float32Array(this.capacity*3);
    for(let i=0;i<this.capacity;i++)positions[i*3+1]=-500;
    this.positions=positions;this.colors=colors;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
    this.points=new THREE.Points(geometry,new THREE.PointsMaterial({size:.2,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.95,depthWrite:false}));
    this.points.frustumCulled=false;scene.add(this.points);
  }
  emit(position,count=18,color='#fff8c1',force=4,confetti=false){
    const base=new THREE.Color(color);
    for(let n=0;n<count;n++){
      const i=this.cursor++%this.capacity;
      let t=this.pool[i]||(this.pool[i]={});
      const a=Math.random()*Math.PI*2,u=Math.random()*2-1,s=Math.sqrt(1-u*u),strength=force*(.4+Math.random()*.8);
      t.life=t.maxLife=confetti?1.4+Math.random()*1.45:.4+Math.random()*.47;
      t.x=position.x+(Math.random()-.5)*.3;t.y=position.y;t.z=position.z+(Math.random()-.5)*.3;
      t.vx=Math.cos(a)*s*strength;t.vy=(confetti?3:1.5)+Math.max(-.5,u)*strength;t.vz=Math.sin(a)*s*strength;
      t.gravity=confetti?6:12;t.damp=confetti?.991:.985;t.confetti=confetti;
      const chosen=confetti?new THREE.Color(PALETTE[Math.floor(Math.random()*PALETTE.length)]):base.clone().lerp(new THREE.Color('#ffffff'),Math.random()*.6);
      this.colors[i*3]=chosen.r;this.colors[i*3+1]=chosen.g;this.colors[i*3+2]=chosen.b;
    }
    this.points.geometry.attributes.color.needsUpdate=true;
  }
  confetti(origin){this.emit(origin,250,'#ffe67b',12,true);}
  update(dt){
    let dirty=false;
    for(let i=0;i<this.pool.length;i++){
      const p=this.pool[i];if(!p||p.life<=0)continue;
      p.life-=dt;dirty=true;
      if(p.life<=0){this.positions[i*3+1]=-500;continue;}
      p.vx*=p.damp;p.vy=p.vy*p.damp-p.gravity*dt;p.vz*=p.damp;
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
      this.positions[i*3]=p.x;this.positions[i*3+1]=p.y;this.positions[i*3+2]=p.z;
    }
    if(dirty)this.points.geometry.attributes.position.needsUpdate=true;
  }
  clear(){this.pool.forEach((p,i)=>{if(p)p.life=0;this.positions[i*3+1]=-500;});this.points.geometry.attributes.position.needsUpdate=true;}
  popup(worldPos,text,color='#fff5a3'){
    const pos=new THREE.Vector3(worldPos.x,worldPos.y,worldPos.z).project(this.camera);
    const x=(pos.x*.5+.5)*window.innerWidth, y=(-pos.y*.5+.5)*window.innerHeight;
    const element=document.createElement('span');element.className='toast';element.textContent=text;element.style.color=color;
    element.style.left=`${Math.max(35,Math.min(window.innerWidth-35,x))}px`;element.style.top=`${Math.max(90,Math.min(window.innerHeight-120,y))}px`;
    document.getElementById('popupLayer').append(element);setTimeout(()=>element.remove(),850);
  }
  // A squash-and-pop comic impact, projected from the actual physics position.
  impactBurst(worldPos,text='BAM!',color='#ffc14d'){
    const pos=new THREE.Vector3(worldPos.x,worldPos.y,worldPos.z).project(this.camera);
    if(pos.z>1)return;
    const x=(pos.x*.5+.5)*window.innerWidth,y=(-pos.y*.5+.5)*window.innerHeight;
    const element=document.createElement('div');element.className='impact-burst';
    element.style.setProperty('--burst-color',color);
    element.style.left=`${Math.max(45,Math.min(window.innerWidth-45,x))}px`;
    element.style.top=`${Math.max(130,Math.min(window.innerHeight-145,y))}px`;
    const word=document.createElement('span');word.textContent=text;element.append(word);
    document.getElementById('popupLayer').append(element);
    setTimeout(()=>element.remove(),620);
  }
}
