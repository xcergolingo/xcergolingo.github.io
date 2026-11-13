/* Panda Lingo — a small, entirely procedural bamboo garden. */
export function createGarden(THREE, scene) {
  const garden = new THREE.Group();
  garden.name = 'Bamboo garden';
  scene.add(garden);
  const owned = [];
  let seed = 347191;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a, b) => a + (b - a) * random();
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({color, roughness: .91, ...extra}); owned.push(m); return m; };
  const geo = g => { owned.push(g); return g; };
  const sphere = geo(new THREE.SphereGeometry(1, 18, 12));
  const stoneGeometry = geo(new THREE.IcosahedronGeometry(1, 2));
  const stalkGeometry = geo(new THREE.CylinderGeometry(1, 1.06, 1, 8));
  const nodeGeometry = geo(new THREE.CylinderGeometry(1, 1, 1, 9));
  const leafGeometry = (() => {
    const points = [0,0,0, -.12,.26,.025, -.145,.56,.055, -.075,.82,.04, 0,1,0, .075,.82,.04, .145,.56,.055, .12,.26,.025, 0,.48,.105];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    g.setIndex([0,1,8,1,2,8,2,3,8,3,4,8,4,5,8,5,6,8,6,7,8,7,0,8]);
    g.computeVertexNormals(); return geo(g);
  })();
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const v = new THREE.Vector3();
  const bambooMaterial = mat('#537b36');
  const bambooNodeMaterial = mat('#a3ad55');
  const leafMaterial = mat('#467e32', {side: THREE.DoubleSide});
  const stoneMaterial = mat('#718773');
  const mossMaterial = mat('#799946');
  const petalMaterial = mat('#f68bad', {side: THREE.DoubleSide});
  const stemMaterial = mat('#4a7433');
  const yellowMaterial = mat('#f5cd60');
  const records = {stalks: [], nodes: [], leaves: [], rocks: [], moss: [], petals: [], centers: [], stems: [], grass: []};
  const addRecord = (name, position, scale, rotation = [0,0,0], color) => records[name].push({position, scale, rotation, color});
  const segment = (name, start, end, radius, color) => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const length = a.distanceTo(b); v.subVectors(b,a).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up,v);
    records[name].push({position: a.add(b).multiplyScalar(.5).toArray(), scale: [radius,length,radius], quaternion, color});
  };
  const batch = (name, geometry, material, shadow = true) => {
    const list = records[name]; if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true;
    list.forEach((r, i) => {
      dummy.position.set(...r.position); dummy.scale.set(...r.scale);
      if(r.quaternion) dummy.quaternion.copy(r.quaternion); else dummy.rotation.set(...r.rotation);
      dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
      if (r.color) mesh.setColorAt(i, new THREE.Color(r.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if(mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    garden.add(mesh); return mesh;
  };

  // A gently mottled, painterly ground without a repeating grid.
  const groundCanvas = document.createElement('canvas'); groundCanvas.width = groundCanvas.height = 256;
  const groundCtx = groundCanvas.getContext('2d');
  groundCtx.fillStyle = '#879961'; groundCtx.fillRect(0,0,256,256);
  for (let i=0;i<90;i++) {
    const x=range(0,256), y=range(0,256), r=range(8,65);
    const gr = groundCtx.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0, i%4 ? 'rgba(58,99,34,.17)' : 'rgba(226,206,141,.18)');
    gr.addColorStop(1,'rgba(100,140,70,0)'); groundCtx.fillStyle=gr; groundCtx.fillRect(x-r,y-r,r*2,r*2);
  }
  const groundTexture = new THREE.CanvasTexture(groundCanvas);
  groundTexture.colorSpace = THREE.SRGBColorSpace; groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
  groundTexture.repeat.set(4,4); owned.push(groundTexture);
  const ground = new THREE.Mesh(geo(new THREE.PlaneGeometry(70,70)), mat('#ffffff',{map:groundTexture}));
  ground.rotation.x=-Math.PI/2; ground.position.y=-.065; ground.receiveShadow=true; garden.add(ground);
  const clearing = new THREE.Mesh(sphere,mat('#a3aa72'));
  clearing.position.set(-1.3,-.17,1.25); clearing.scale.set(4.3,.21,2.65); clearing.receiveShadow=true; garden.add(clearing);

  // Water settles into a shallow jade pool behind the teaching clearing.
  const waterUniforms = {time: {value:0}};
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms:waterUniforms, transparent:true, depthWrite:false,
    vertexShader:`varying vec2 vUv; uniform float time; void main(){vUv=uv; vec3 p=position; p.z+=sin(p.x*4.+time*.8)*.012+cos(p.y*5.-time)*.009; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv; uniform float time; void main(){float a=sin((vUv.x*20.+vUv.y*13.)+time*.8); float b=sin(vUv.y*62.+sin(vUv.x*16.+time)*1.7-time*1.3); float ripple=pow(max(0.,b),18.)*.12; vec3 col=mix(vec3(.13,.43,.39),vec3(.38,.71,.59),vUv.y*.6+.24+a*.055); gl_FragColor=vec4(col+ripple,.94);}`
  }); owned.push(waterMaterial);
  const pool = new THREE.Mesh(geo(new THREE.CircleGeometry(1,64)),waterMaterial);
  pool.rotation.x=-Math.PI/2; pool.scale.set(3.45,2.3,1); pool.position.set(-4.8,.012,-3.65); pool.renderOrder=1; garden.add(pool);
  for(let i=0;i<33;i++) {
    const angle=i/33*Math.PI*2;
    const x=-4.8+Math.cos(angle)*3.5, z=-3.65+Math.sin(angle)*2.35;
    addRecord('rocks',[x,range(.02,.11),z],[range(.22,.53),range(.15,.31),range(.23,.45)],[range(0,2),range(0,6),range(0,1)],new THREE.Color().setHSL(.24,range(.08,.2),range(.33,.46)));
  }

  // Rounded stacked rocks shape a lush, low cliff behind the waterfall.
  for(let i=0;i<23;i++) {
    const x=range(-8.5,-3.5), z=range(-7.9,-6.1), y=range(.4,3.2);
    const s=range(.5,1.2);
    addRecord('rocks',[x,y,z],[s,range(.6,1.3),s*.72],[range(0,2),range(0,6),range(0,2)],new THREE.Color().setHSL(.25,.10,range(.35,.48)));
    if(i%2===0) addRecord('moss',[x,y+range(.4,.7),z],[s*.9,.15,s*.65],[0,0,range(-.2,.2)]);
  }
  // A dark shallow recess helps the falling water read clearly in daylight.
  const recess=new THREE.Mesh(sphere,mat('#446759'));
  recess.position.set(-5.65,2.05,-6.28); recess.scale.set(1.2,2.15,.45); garden.add(recess);
  const fallsUniforms={time:{value:0}};
  const fallMaterial=new THREE.ShaderMaterial({
    uniforms:fallsUniforms, transparent:true, depthWrite:false, side:THREE.DoubleSide,
    vertexShader:`uniform float time; varying vec2 vUv; void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.y*16.+time*2.3)*.028;p.x+=sin(uv.y*9.-time*1.8)*.023;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`uniform float time; varying vec2 vUv; void main(){float streak=sin(vUv.x*97.+sin(vUv.y*7.-time*2.))*0.5+0.5;float flow=sin(vUv.y*40.+time*5.5+vUv.x*9.)*.5+.5;float edge=smoothstep(0.,.11,vUv.x)*smoothstep(0.,.11,1.-vUv.x);vec3 col=mix(vec3(.50,.78,.79),vec3(.97,1.,.94),streak*.52+flow*.13+.2);gl_FragColor=vec4(col,edge*(.64+streak*.27));}`
  });owned.push(fallMaterial);
  const fallGeo=geo(new THREE.PlaneGeometry(1,1,8,26));
  [[-5.8,2.12,-5.76,1.22,3.95],[-6.65,1.56,-5.99,.46,2.9],[-4.94,1.8,-5.92,.35,3.3]].forEach(([x,y,z,w,h])=>{
    const m=new THREE.Mesh(fallGeo,fallMaterial);m.position.set(x,y,z);m.scale.set(w,h,1);m.renderOrder=2;garden.add(m);
  });
  addRecord('moss',[-5.65,4.06,-6.25],[1.45,.18,.8]);

  // Bamboo grows in irregular stands, with small slender leaves rather than cards.
  const stands=[[-8,1.7],[-7.8,-3],[-9.8,-7],[-3.1,-8.8],[.2,-9.6],[3.4,-8.9],[6.8,-7.4],[8.8,-2],[8,2.5],[5.4,-5.2],[-10,-11],[10,-11]];
  stands.forEach(([cx,cz],standIndex)=>{
    for(let k=0;k<3;k++) {
      const x=cx+range(-.6,.6), z=cz+range(-.55,.55), height=range(4.2,7.8);
      const lean=range(-.35,.35), leanZ=range(-.25,.25), radius=range(.055,.10);
      segment('stalks',[x,0,z],[x+lean,height,z+leanZ],radius,new THREE.Color().setHSL(range(.22,.27),.39,range(.33,.47)));
      for(let h=.5;h<height;h+=.7) {
        const xx=x+lean*h/height, zz=z+leanZ*h/height;
        addRecord('nodes',[xx,h,zz],[radius*1.16,.055,radius*1.16],[0,0,0]);
        if(h<2.2||random()>.57) continue;
        const side=random()<.5?-1:1, extension=range(.55,1.2);
        const end=[xx+side*extension,h+.25,zz+range(-.2,.25)];
        segment('stalks',[xx,h,zz],end,.017);
        for(let j=0;j<7;j++) {
          const f=j/7, lx=xx+(end[0]-xx)*f, ly=h+.25*f, lz=zz+(end[2]-zz)*f;
          addRecord('leaves',[lx,ly,lz],[range(.7,1.1),range(.42,.8),1],[range(-.9,.9),range(0,6.28),side*(j%2?-.8:-1.8)],new THREE.Color().setHSL(range(.22,.31),range(.43,.57),range(.27,.43)));
        }
      }
    }
  });

  // Canopy islands keep the distant garden soft and full.
  const canopyGeo=geo(new THREE.IcosahedronGeometry(1,2));
  const canopyMaterial=mat('#3d6a42');
  const canopy=new THREE.InstancedMesh(canopyGeo,canopyMaterial,28);
  for(let i=0;i<28;i++) {
    dummy.position.set(range(-16,16),range(3.9,7.5),range(-17,-11));
    dummy.scale.set(range(1.4,3.4),range(1.5,3),range(1.5,2.8));dummy.rotation.set(random(),random(),random());dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);
    canopy.setColorAt(i,new THREE.Color().setHSL(range(.27,.36),range(.20,.36),range(.27,.42)));
  } canopy.receiveShadow=true;garden.add(canopy);

  // Low ferns and grass frame the foreground, leaving room for panda's feet.
  const plantCenters=[[-5,2],[-6,3.5],[-7,1],[3.5,3.1],[5,1.2],[7,3],[-1.1,-5.4],[1.3,-4.7],[4,-3.1],[-8,-4],[-5.8,-.4]];
  plantCenters.forEach(([x,z],n)=>{
    for(let j=0;j<9;j++) {
      const angle=j/9*Math.PI*2+random()*.3, length=range(.45,1.1), cx=x+Math.sin(angle)*.1, cz=z+Math.cos(angle)*.1;
      const leafBase=[cx,.02,cz];
      addRecord('leaves',leafBase,[range(1.1,1.8),length,1],[Math.sin(angle)*1.05,angle,Math.cos(angle)*.8],new THREE.Color().setHSL(.26,.48,range(.29,.42)));
      // Small paired fern leaflets on a gracefully bowed stem.
      if(j%2) for(let k=1;k<5;k++) {
        const f=k/5, xx=cx+Math.sin(angle)*length*f*.75, yy=Math.sin(f*Math.PI*.75)*length*.6, zz=cz+Math.cos(angle)*length*f*.75;
        for(const side of [-1,1]) addRecord('leaves',[xx,yy,zz],[.6,.22*(1-f*.35),1],[.8,angle+side*1.15,side*.8]);
      }
    }
    for(let j=0;j<24;j++) {
      addRecord('grass',[x+range(-.8,.8),.005,z+range(-.6,.6)],[range(.18,.32),range(.16,.4),1],[range(-.2,.2),range(0,6.28),range(-.45,.45)],new THREE.Color().setHSL(.24,.48,range(.36,.52)));
    }
  });
  for(let i=0;i<37;i++) {
    let x=range(-10,10), z=range(-9,4);
    if(x>-4.3&&x<2.8&&z>-.9)continue;
    addRecord('rocks',[x,.03,z],[range(.17,.4),range(.1,.22),range(.18,.38)],[range(0,3),range(0,6),range(0,2)]);
  }

  // Hibiscus blossoms: five soft cupped petals and a bright pollen center.
  const flowerLocations=[[-5.2,2.2],[-6.2,3.1],[-4.9,3.75],[4.6,3.1],[6.1,2],[7,3.9],[-7,-.3],[-3.8,-5.6],[3.8,-4.7],[-7.1,-4.6]];
  flowerLocations.forEach(([x,z],index)=>{
    const y=range(.28,.58), scale=range(.21,.33);
    segment('stems',[x,0,z],[x,y,z],.022);
    for(let p=0;p<5;p++) {
      const a=p/5*Math.PI*2;
      addRecord('petals',[x+Math.cos(a)*scale*.61,y+Math.sin(a)*scale*.61,z],[scale*.67,scale,.065],[.15,0,a-Math.PI/2],index%3===0?'#f7c6d7':index%3===1?'#f397b4':'#e96b94');
    }
    addRecord('centers',[x,y,z+.08],[scale*.22,scale*.22,scale*.19]);
    for(const side of [-1,1])addRecord('leaves',[x,y*.45,z],[.6,.33,1],[0,side*.4,side*1.05]);
  });

  batch('stalks',stalkGeometry,bambooMaterial);
  batch('nodes',nodeGeometry,bambooNodeMaterial);
  batch('leaves',leafGeometry,leafMaterial,false);
  batch('grass',leafGeometry,leafMaterial,false);
  batch('rocks',stoneGeometry,stoneMaterial);
  batch('moss',sphere,mossMaterial,false);
  batch('petals',sphere,petalMaterial,false);
  batch('centers',sphere,yellowMaterial,false);
  batch('stems',stalkGeometry,stemMaterial,false);

  // Drifting mist at the foot of the falls is one soft particle draw.
  const radialCanvas=document.createElement('canvas');radialCanvas.width=radialCanvas.height=64;
  const rc=radialCanvas.getContext('2d'), gradient=rc.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.55)');gradient.addColorStop(1,'rgba(255,255,255,0)');rc.fillStyle=gradient;rc.fillRect(0,0,64,64);
  const radial=new THREE.CanvasTexture(radialCanvas);owned.push(radial);
  const mistGeo=geo(new THREE.BufferGeometry()), mistPos=new Float32Array(22*3), mistSeeds=[];
  for(let i=0;i<22;i++)mistSeeds.push({x:range(-6.9,-4.3),y:range(.15,.65),z:range(-6,-4.8),phase:range(0,7)});
  mistGeo.setAttribute('position',new THREE.BufferAttribute(mistPos,3));
  const mistMat=new THREE.PointsMaterial({color:'#e9fff1',size:1.5,map:radial,transparent:true,opacity:.14,depthWrite:false});owned.push(mistMat);
  const mist=new THREE.Points(mistGeo,mistMat);mist.renderOrder=3;garden.add(mist);

  const moteCount=65, moteGeo=geo(new THREE.BufferGeometry()), motePos=new Float32Array(moteCount*3), moteSeeds=[];
  for(let i=0;i<moteCount;i++)moteSeeds.push({x:range(-9,9),y:range(.35,6),z:range(-9,3),phase:range(0,7)});
  moteGeo.setAttribute('position',new THREE.BufferAttribute(motePos,3));
  const moteMat=new THREE.PointsMaterial({color:'#fff4b3',map:radial,size:.055,transparent:true,opacity:.75,depthWrite:false});owned.push(moteMat);garden.add(new THREE.Points(moteGeo,moteMat));

  // A handful of butterflies make the scene feel alive, all batched together.
  const butterflyWings=new THREE.InstancedMesh(sphere,mat('#ffcf98',{roughness:.8}),12);
  const butterflyBodies=new THREE.InstancedMesh(sphere,mat('#584a35'),6);
  const butterflySeeds=[];
  for(let i=0;i<6;i++) {
    butterflySeeds.push({x:range(-7,6),y:range(.7,2.3),z:range(-5,2),phase:range(0,6.28)});
    for(let side=0;side<2;side++)butterflyWings.setColorAt(i*2+side,new THREE.Color(i%3===0?'#ffb8ca':i%3===1?'#f3ce64':'#a2dce0'));
  } garden.add(butterflyWings,butterflyBodies);

  const burstCount=64, burstGeo=geo(new THREE.BufferGeometry()), burstPos=new Float32Array(burstCount*3), burstColors=new Float32Array(burstCount*3);
  burstGeo.setAttribute('position',new THREE.BufferAttribute(burstPos,3));
  burstGeo.setAttribute('color',new THREE.BufferAttribute(burstColors,3));
  const burstMaterial=new THREE.PointsMaterial({map:radial,size:.14,vertexColors:true,transparent:true,opacity:0,depthWrite:false});owned.push(burstMaterial);
  const burst=new THREE.Points(burstGeo,burstMaterial);burst.frustumCulled=false;garden.add(burst);
  let burstAge=99, burstOrigin=new THREE.Vector3(-2,2.1,1.1);const burstSpeeds=[];
  for(let i=0;i<burstCount;i++) {
    burstSpeeds.push(new THREE.Vector3(range(-2.7,2.7),range(1.4,4.5),range(-1.3,1.3)));
    new THREE.Color(['#ffdc65','#ffd2da','#bce783','#f9f1d5'][i%4]).toArray(burstColors,i*3);
  }

  return {
    group:garden,
    update(time,dt=.016) {
      waterUniforms.time.value=time; fallsUniforms.time.value=time;
      for(let i=0;i<mistSeeds.length;i++) {
        const m=mistSeeds[i];mistPos[i*3]=m.x+Math.sin(time*.22+m.phase)*.38;mistPos[i*3+1]=m.y+Math.sin(time*.5+m.phase)*.12;mistPos[i*3+2]=m.z+Math.cos(time*.17+m.phase)*.2;
      }mistGeo.attributes.position.needsUpdate=true;
      for(let i=0;i<moteCount;i++) {
        const m=moteSeeds[i];motePos[i*3]=m.x+Math.sin(time*.13+m.phase)*.45;motePos[i*3+1]=m.y+Math.sin(time*.21+m.phase)*.18;motePos[i*3+2]=m.z+Math.cos(time*.12+m.phase)*.4;
      }moteGeo.attributes.position.needsUpdate=true;
      butterflySeeds.forEach((b,i)=>{
        const x=b.x+Math.sin(time*.36+b.phase)*.7, y=b.y+Math.cos(time*.6+b.phase)*.25, z=b.z+Math.cos(time*.22+b.phase)*.55;
        dummy.position.set(x,y,z);dummy.scale.set(.023,.08,.022);dummy.rotation.set(.2,Math.sin(time*.3+b.phase),.25);dummy.updateMatrix();butterflyBodies.setMatrixAt(i,dummy.matrix);
        for(let side=0;side<2;side++) {
          const sign=side?1:-1, flap=Math.sin(time*12+b.phase)*.8;
          dummy.position.set(x+sign*.065,y,z);dummy.scale.set(.09,.085,.012);dummy.rotation.set(.2,sign*flap,.2);dummy.updateMatrix();butterflyWings.setMatrixAt(i*2+side,dummy.matrix);
        }
      });butterflyWings.instanceMatrix.needsUpdate=true;butterflyBodies.instanceMatrix.needsUpdate=true;
      if(burstAge<2) {
        burstAge+=Math.min(dt,.05);
        for(let i=0;i<burstCount;i++) {const s=burstSpeeds[i];burstPos[i*3]=burstOrigin.x+s.x*burstAge;burstPos[i*3+1]=burstOrigin.y+s.y*burstAge-2.9*burstAge*burstAge;burstPos[i*3+2]=burstOrigin.z+s.z*burstAge;}
        burstGeo.attributes.position.needsUpdate=true;burstMaterial.opacity=Math.max(0,1-burstAge/1.75);
      }
    },
    celebrate(position) { if(position)burstOrigin.copy(position);else burstOrigin.set(-2,2.1,1.1);burstAge=0;burstMaterial.opacity=1; },
    dispose() {scene.remove(garden);for(const item of owned)item.dispose();}
  };
}
