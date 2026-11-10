// Procedural aircraft construction kit. Coordinates: nose +Z, up +Y.
export function createHelpers(THREE) {
  const V = (v) => new THREE.Vector3(...v);
  const group = (parent, name) => { const g = new THREE.Group(); g.name = name; parent?.add(g); return g; };
  const mat = (color, opts = {}) => new THREE.MeshPhysicalMaterial({ color, roughness:.36, metalness:.25, clearcoat:.55, clearcoatRoughness:.24, ...opts });
  const mesh = (parent,name,geometry,material,pos=[0,0,0],rot=[0,0,0]) => { const m=new THREE.Mesh(geometry,material); m.name=name; m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m; };
  const box = (parent,name,size,pos,material,rot=[0,0,0]) => mesh(parent,name,new THREE.BoxGeometry(...size),material,pos,rot);
  const ellipsoid = (parent,name,pos,scale,material) => {const m=mesh(parent,name,new THREE.SphereGeometry(1,32,20),material,pos);m.scale.set(...scale);return m;};
  const rod = (parent,name,a,b,radius,material,radius2=radius) => {const av=V(a),bv=V(b),delta=bv.clone().sub(av);const m=mesh(parent,name,new THREE.CylinderGeometry(radius2,radius,delta.length(),12),material,av.add(bv).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
  const line = (parent,name,points,color=0x35424b,opacity=.45) => {const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(V)),new THREE.LineBasicMaterial({color,transparent:true,opacity}));m.name=name;m.userData.isSeam=true;parent.add(m);return m;};
  function interp(stations,subdiv=4) {
    const out=[];
    for(let i=0;i<stations.length-1;i++) {
      const p0=stations[Math.max(0,i-1)],p1=stations[i],p2=stations[i+1],p3=stations[Math.min(stations.length-1,i+2)];
      for(let j=0;j<subdiv;j++){const t=j/subdiv,t2=t*t,t3=t2*t;const row=[];for(let k=0;k<5;k++){if(k===0){row[k]=THREE.MathUtils.lerp(p1[k],p2[k],t);continue;}const a=p0[k]??0,b=p1[k]??0,c=p2[k]??0,d=p3[k]??0;row[k]=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);if(k===1||k===2)row[k]=Math.max(.001,row[k]);}out.push(row);}
    }
    out.push(stations.at(-1));return out;
  }
  function loft(parent,name,stations,material,options={}) {
    const st=interp([...stations].sort((a,b)=>a[0]-b[0]),options.subdiv??4),N=options.segments??56;
    const start=options.angleStart??0,len=options.angleLength??Math.PI*2;
    const positions=[],uvs=[],indices=[];
    for(let i=0;i<st.length;i++){const [z,rx,ry,y=0,x=0]=st[i];for(let j=0;j<=N;j++){const a=start+len*j/N;positions.push(x+Math.sin(a)*rx,y+Math.cos(a)*ry,z);uvs.push(j/N,i/(st.length-1));}}
    for(let i=0;i<st.length-1;i++)for(let j=0;j<N;j++){const a=i*(N+1)+j,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);}
    if(Math.abs(len-Math.PI*2)<.001)for(const end of [0,st.length-1]){const [z,,,y=0,x=0]=st[end],ci=positions.length/3;positions.push(x,y,z);uvs.push(.5,.5);for(let j=0;j<N;j++){const a=end*(N+1)+j; if(end===0)indices.push(ci,a,a+1);else indices.push(ci,a+1,a);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return mesh(parent,name,geo,material);
  }
  function wing(parent,name,stations,material) {
    const st=[...stations].sort((a,b)=>a[0]-b[0]);const N=28,ps=[],uv=[],idx=[],n=st.length;
    for(let side=0;side<2;side++)for(let i=0;i<n;i++){const [x,lead,trail,y=0,th=.12]=st[i];for(let j=0;j<=N;j++){const t=j/N,shape=5*th*(.2969*Math.sqrt(t)-.126*t-.3516*t*t+.2843*t*t*t-.1036*t*t*t*t);ps.push(x,y+(lead-trail)*.012*Math.sin(Math.PI*t)+(side?-1:1)*Math.max(.002,shape),THREE.MathUtils.lerp(lead,trail,t));uv.push(i/(n-1),t);}}
    const stride=N+1,half=n*stride;
    for(let side=0;side<2;side++)for(let i=0;i<n-1;i++)for(let j=0;j<N;j++){const a=side*half+i*stride+j,b=a+stride;if(!side)idx.push(a,b,a+1,b,b+1,a+1);else idx.push(a,a+1,b,b,a+1,b+1);}
    for(let i=0;i<n-1;i++)for(const j of [0,N]){const a=i*stride+j,b=a+stride,c=a+half,d=b+half;if(j===0)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}
    for(const i of [0,n-1])for(let j=0;j<N;j++){const a=i*stride+j,b=a+1,c=a+half,d=b+half;if(i===0)idx.push(a,b,c,b,d,c);else idx.push(a,c,b,b,c,d);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return mesh(parent,name,geo,material);
  }
  function fin(parent,name,pointsYZ,thickness,x,material) {
    const s=new THREE.Shape();pointsYZ.forEach(([y,z],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y));s.closePath();
    const geo=new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:Math.min(.025,thickness*.2),bevelThickness:Math.min(.025,thickness*.2)});geo.translate(0,0,-thickness/2);geo.rotateY(Math.PI/2);return mesh(parent,name,geo,material,[x,0,0]);
  }
  function decal(parent,name,{width,height,pos,rot=[0,0,0],draw,canvasWidth=1024,canvasHeight=512,opacity=1}){
    const canvas=document.createElement('canvas');canvas.width=canvasWidth;canvas.height=canvasHeight;const c=canvas.getContext('2d');draw(c,canvasWidth,canvasHeight);const tx=new THREE.CanvasTexture(canvas);tx.colorSpace=THREE.SRGBColorSpace;tx.anisotropy=8;const material=new THREE.MeshStandardMaterial({map:tx,transparent:true,opacity,depthWrite:false,roughness:.42,metalness:.1,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide});const m=mesh(parent,name,new THREE.PlaneGeometry(width,height),material,pos,rot);m.castShadow=false;m.renderOrder=3;return m;
  }
  const star=(ctx,cx,cy,r,color)=>{ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.40:r;const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();};
  function usRoundel(c,w,h){c.fillStyle='#172735';c.fillRect(w*.03,h*.31,w*.94,h*.38);c.fillStyle='#fff';c.fillRect(w*.06,h*.36,w*.88,h*.28);c.fillStyle='#d71d2c';c.fillRect(w*.06,h*.465,w*.88,h*.07);c.fillStyle='#172735';c.beginPath();c.arc(w*.5,h*.5,h*.47,0,Math.PI*2);c.fill();star(c,w*.5,h*.5,h*.445,'#fff');}
  const chrome=mat(0xb4bec4,{metalness:.88,roughness:.2}),dark=mat(0x172027,{metalness:.1,roughness:.76}),rubber=mat(0x141718,{metalness:0,roughness:.93,clearcoat:0}),hubmat=mat(0xa8adb0,{roughness:.3,metalness:.8});
  function wheel(parent,name,x,y,z,radius,width){const g=group(parent,name);g.position.set(x,y,z);const tire=mesh(g,'Rubber tire',new THREE.TorusGeometry(radius*.73,radius*.27,10,28),rubber,[0,0,0],[0,Math.PI/2,0]);tire.scale.z=width/(radius*.54);mesh(g,'Recessed hub',new THREE.CylinderGeometry(radius*.61,radius*.61,width*.92,24),hubmat,[0,0,0],[0,0,Math.PI/2]);for(const s of [-1,1]){mesh(g,'Axle cap',new THREE.CylinderGeometry(radius*.18,radius*.18,.028,14),chrome,[s*width*.51,0,0],[0,0,Math.PI/2]);for(let i=0;i<8;i++){const a=i*Math.PI/4;mesh(g,'Brake ventilation',new THREE.CylinderGeometry(radius*.075,radius*.075,.012,8),dark,[s*width*.49,Math.cos(a)*radius*.42,Math.sin(a)*radius*.42],[0,0,Math.PI/2]);}}return g;}
  // Subtract convex wheel-bay volumes from the existing skin. The removed
  // triangles become thin, color-matched doors, so a shut door fits the hull.
  function cutBaySurface(geometry, transform, volume) {
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
    if(!p)return null;
    const normalTransform=new THREE.Matrix3().getNormalMatrix(transform);
    const planes=[
      [0,volume.min[0],1],[0,volume.max[0],-1],
      [1,volume.min[1],1],[1,volume.max[1],-1],
      [2,volume.min[2],1],[2,volume.max[2],-1]
    ];
    const keep=[],removed=[];
    const vertex=i=>{const local=[p.getX(i),p.getY(i),p.getZ(i)];return{p:local,w:V(local).applyMatrix4(transform).toArray(),n:n?[n.getX(i),n.getY(i),n.getZ(i)]:[0,-1,0],uv:uv?[uv.getX(i),uv.getY(i)]:[0,0]};};
    const lerp=(a,b,t)=>{const v={};for(const key of ['p','w','n','uv'])v[key]=a[key].map((x,i)=>x+(b[key][i]-x)*t);return v;};
    const triangulate=(poly,out)=>{for(let i=1;i<poly.length-1;i++)out.push(poly[0],poly[i],poly[i+1]);};
    const count=geometry.index?.count??p.count;
    for(let i=0;i<count;i+=3){let inside=[0,1,2].map(j=>vertex(geometry.index?geometry.index.getX(i+j):i+j));
      for(const [axis,bound,sign] of planes){if(inside.length<3)break;const next=[],outside=[];
        for(let j=0;j<inside.length;j++){const a=inside[j],b=inside[(j+1)%inside.length],da=(a.w[axis]-bound)*sign,db=(b.w[axis]-bound)*sign,ia=da>=-1e-8,ib=db>=-1e-8;
          (ia?next:outside).push(a);
          if(ia!==ib){const mid=lerp(a,b,da/(da-db));next.push(mid);outside.push(mid);}
        }
        triangulate(outside,keep);inside=next;
      }
      triangulate(inside,removed);
    }
    if(!removed.length)return null;
    const build=(vertices,world)=>{const ps=[],ns=[],us=[];for(const v of vertices){ps.push(...(world?v.w:v.p));const nn=V(v.n);if(world)nn.applyMatrix3(normalTransform);nn.normalize();ns.push(...nn.toArray());us.push(...v.uv);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(ns,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(us,2));g.computeBoundingBox();g.computeBoundingSphere();return g;};
    return{skin:build(keep,false),panel:build(removed,true)};
  }

  function gear(parent,options={}) {
    const {noseZ=3.4,mainZ=-.8,track=1.1,attachY=-.15,groundY=-1.6,wheelRadius=.24,mainRadius=.32,
      noseHinge=[0,-.10,noseZ],noseStow=[0,-.03,noseZ-1.15],
      mainHinge=[.56,attachY,mainZ],mainStow=[.36,.02,mainZ+1.1],mainFlat=true,linkLengthScale=.565,
      skinNames=[],noseBay,mainBay}=options;
    const g=group(parent,'Retractable tricycle landing gear');
    g.userData.component='landing-gear';g.userData.gearRevision=2;
    g.userData.retraction='Three separate fixed hinges, constant-length folding links, wheel rotation, and sequenced flush skin doors.';
    const bayRoot=group(g,'Recessed wheel bays and hinged skin panels');
    const assemblies=[];
    const clamp=t=>THREE.MathUtils.clamp(Number.isFinite(t)?t:1,0,1);
    const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
    const mirrored=(p,side)=>[p[0]*side,p[1],p[2]];
    const mirrorBay=(b,side)=>side>0?{min:[...b.min],max:[...b.max]}:{min:[-b.max[0],b.min[1],b.min[2]],max:[-b.min[0],b.max[1],b.max[2]]};
    const movableRod=(p,name,r,m)=>mesh(p,name,new THREE.CylinderGeometry(r,r,1,12),m);
    const pointRod=(m,a,b)=>{const delta=b.clone().sub(a),length=delta.length();m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(1,Math.max(.0001,length),1);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());};
    parent.updateMatrixWorld(true);
    const rootInverse=parent.matrixWorld.clone().invert(),skins=[];
    parent.traverse(o=>{if(o.isMesh&&skinNames.includes(o.name))skins.push(o);});

    for(const side of [0,-1,1]) {
      const main=side!==0,r=main?mainRadius:wheelRadius;
      const hinge=V(main?mirrored(mainHinge,side):noseHinge);
      const down=V([side*track,groundY+r,main?mainZ:noseZ]);
      const stow=V(main?mirrored(mainStow,side):noseStow);
      const flat=main&&mainFlat;
      const pivot=group(g,main?(side<0?'Port main gear pivot':'Starboard main gear pivot'):'Nose gear pivot');
      pivot.position.copy(hinge);pivot.userData.gearSide=side;pivot.userData.fixedHinge=true;
      const localDown=down.clone().sub(hinge),localStow=stow.clone().sub(hinge);
      const width=r*.68,forkHeight=r*.84;
      const yoke=group(pivot,'Articulated axle and wheel fork');
      const tire=wheel(yoke,'Wheel, tire and brake',0,0,0,r,width);
      tire.userData.gearSide=side;tire.userData.stowedCenter=stow.toArray();tire.userData.extendedCenter=down.toArray();
      // This assembly is a narrow U-shaped wheel fork, not a door or box.
      for(const fork of [-1,1]){
        rod(yoke,'Wheel fork arm',[fork*width*.61,0,0],[fork*width*.61,forkHeight*.74,-.035],.025,hubmat);
        rod(yoke,'Wheel fork crown',[fork*width*.61,forkHeight*.74,-.035],[0,forkHeight,0],.025,chrome);
      }
      rod(yoke,'Wheel axle',[-width*.72,0,0],[width*.72,0,0],.038,chrome);
      ellipsoid(yoke,'Fork swivel bearing',[0,forkHeight,0],[.052,.052,.052],chrome);
      const endDown=localDown.clone().add(new THREE.Vector3(0,forkHeight,0));
      const stowRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),flat?side*Math.PI/2:0);
      const endStow=localStow.clone().add(new THREE.Vector3(0,forkHeight,0).applyQuaternion(stowRotation));
      const reach=Math.max(endDown.length(),endStow.length());
      const upperLength=reach*linkLengthScale,lowerLength=reach*linkLengthScale;
      pivot.userData.linkLengths=[upperLength,lowerLength];
      const upper=movableRod(pivot,'Upper hinged strut',.052,hubmat);
      const lower=movableRod(pivot,'Polished lower strut',.032,chrome);
      const sleeve=movableRod(pivot,'Oleo outer sleeve',.045,hubmat);
      const hingePin=rod(pivot,'Fixed retraction hinge pin',[-.085,0,0],[.085,0,0],.045,chrome);
      const knee=ellipsoid(pivot,'Folding knee joint',[0,0,0],[.063,.063,.063],hubmat);
      const kneePin=movableRod(pivot,'Knee hinge pin',.028,chrome);
      const actOuter=movableRod(pivot,'Retraction actuator cylinder',.031,hubmat);
      const actInner=movableRod(pivot,'Retraction actuator piston',.017,chrome);
      const braceA=movableRod(pivot,'Torque scissor upper link',.017,hubmat),braceB=movableRod(pivot,'Torque scissor lower link',.017,hubmat);
      const defaultVolume=main?{min:[Math.max(.025,stow.x-r-.08),-10,Math.min(mainZ,stow.z)-r-.1],max:[Math.max(stow.x+r+.08,track*.62),.08,Math.max(mainZ,stow.z)+r+.1]}:{min:[-.17,-10,Math.min(noseZ,stow.z)-r-.1],max:[.17,.08,Math.max(noseZ,stow.z)+r+.1]};
      const volume=main&&mainBay?mirrorBay(mainBay,side):!main&&noseBay?{min:[...noseBay.min],max:[...noseBay.max]}:defaultVolume;
      const bay=group(bayRoot,main?(side<0?'Port wheel bay':'Starboard wheel bay'):'Nose wheel bay');
      bay.userData.opening=volume;
      const doorSide=main?side:-1;
      const hingeX=doorSide<0?volume.min[0]:volume.max[0];
      const doorHinge=V([hingeX,volume.max[1]-.035,(volume.min[2]+volume.max[2])*.5]);
      const door=group(bay,'Hinged flush gear door');door.position.copy(doorHinge);door.userData.component='gear-door';door.userData.surfaceThickness=.012;
      let panelCount=0;
      for(const skin of skins){
        const transform=rootInverse.clone().multiply(skin.matrixWorld);
        const cut=cutBaySurface(skin.geometry,transform,volume);if(!cut)continue;
        skin.geometry=cut.skin;
        // Both faces of a thin sheet remain visible while the door is open.
        const skinMaterial=Array.isArray(skin.material)?skin.material[0]:skin.material;
        if(!skinMaterial.userData.bayInterior){skin.material=skinMaterial.clone();skin.material.side=THREE.DoubleSide;skin.material.userData.bayInterior=true;}
        const panelMaterial=skinMaterial.clone();panelMaterial.side=THREE.DoubleSide;panelMaterial.name=(skinMaterial.name||'Aircraft skin')+' / gear door';
        cut.panel.translate(-doorHinge.x,-doorHinge.y,-doorHinge.z);
        const panel=mesh(door,'Thin conforming wheel-bay door skin',cut.panel,panelMaterial);panel.userData.panelThickness=.012;panelCount++;
        const edges=new THREE.LineSegments(new THREE.EdgesGeometry(cut.panel,32),new THREE.LineBasicMaterial({color:0x303b3d,transparent:true,opacity:.42}));edges.name='Fine wheel-bay door edge';door.add(edges);
      }
      door.userData.panelCount=panelCount;
      // Metadata describes the actual stow envelope, not the exterior opening.
      // It is intentionally generated from the declared end pose for export users.
      const half=flat?[r+.025,width*.56+.025,r+.025]:[width*.56+.025,r+.025,r+.025];
      tire.userData.stowBay={min:stow.toArray().map((x,i)=>x-half[i]),max:stow.toArray().map((x,i)=>x+half[i])};
      assemblies.push({side,main,flat,r,pivot,yoke,tire,hinge,localDown,localStow,forkHeight,upperLength,lowerLength,upper,lower,sleeve,knee,kneePin,actOuter,actInner,braceA,braceB,door,doorSide});
    }

    function setDown(value) {
      const down=clamp(value),retraction=1-down;
      // Door first, leg second, door last. Running the same path backwards
      // gives a coherent deployment and permits reversal at any intermediate pose.
      const travel=smooth((retraction-.10)/.72);
      const doorOpening=retraction<.10?THREE.MathUtils.lerp(.76,1,smooth(retraction/.10)):retraction<.82?1:1-smooth((retraction-.82)/.18);
      g.visible=true;g.userData.deployedFraction=down;
      for(const a of assemblies){
        a.yoke.position.lerpVectors(a.localDown,a.localStow,travel);
        const twist=a.flat?smooth((travel-.16)/.68):0;
        a.yoke.rotation.z=a.side*Math.PI*.5*twist;
        const forkOffset=new THREE.Vector3(0,a.forkHeight,0).applyQuaternion(a.yoke.quaternion);
        const end=a.yoke.position.clone().add(forkOffset);
        const distance=Math.max(.001,end.length()),direction=end.clone().divideScalar(distance);
        let bend;
        if(!a.main)bend=new THREE.Vector3(1,0,0).cross(direction).normalize();
        else{const pole=new THREE.Vector3(a.side*.32,-1,-1);bend=pole.addScaledVector(direction,-pole.dot(direction)).normalize();}
        if(bend.lengthSq()<.1)bend=new THREE.Vector3(0,0,-1);
        const along=(a.upperLength*a.upperLength-a.lowerLength*a.lowerLength+distance*distance)/(2*distance);
        const height=Math.sqrt(Math.max(0,a.upperLength*a.upperLength-along*along));
        const joint=direction.clone().multiplyScalar(along).addScaledVector(bend,height);
        const zero=new THREE.Vector3();
        pointRod(a.upper,zero,joint);pointRod(a.lower,joint,end);
        pointRod(a.sleeve,joint,joint.clone().lerp(end,.45));
        a.knee.position.copy(joint);pointRod(a.kneePin,joint.clone().add(new THREE.Vector3(-.08,0,0)),joint.clone().add(new THREE.Vector3(.08,0,0)));
        const anchor=new THREE.Vector3(a.main?a.side*.08:0,.065,-.16),attach=joint.clone().multiplyScalar(.65),mid=anchor.clone().lerp(attach,.61);
        pointRod(a.actOuter,anchor,mid);pointRod(a.actInner,mid,attach);
        const loA=joint.clone().lerp(end,.51),loB=joint.clone().lerp(end,.80),elbow=loA.clone().lerp(loB,.5).add(new THREE.Vector3(0,0,.075));
        pointRod(a.braceA,loA,elbow);pointRod(a.braceB,elbow,loB);
        a.door.rotation.z=a.doorSide*doorOpening*1.42;
        a.pivot.userData.knee=joint.toArray();a.pivot.userData.wheelCenter=a.yoke.position.toArray();
      }
    }
    setDown(1);return{group:g,setDown};
  }
  function cockpit(parent,{z=2,y=.44,length=2.8,width=1,height=.62,seats=1,frame=0x20292f,glass=0x94b1c5,pilot=true,sideHinge=false}={}){
    const g=group(parent,'Cockpit interior');const fm=mat(frame,{metalness:.2,roughness:.43}),seatmat=mat(0x272d2c,{metalness:.02,roughness:.9}),fabric=mat(0x4f5742,{metalness:0,roughness:.95}),helmet=mat(0xe3e6df,{roughness:.3,metalness:.07});
    ellipsoid(g,'Black cockpit tub',[0,y-.08,z],[width*.49,.15,length*.49],fm);
    for(let i=0;i<seats;i++){const zz=seats===1?z-.12:z+length*.19-i*length*.42;
      const seat=box(g,'Ejection seat back',[width*.46,height*.58,length*.13],[0,y+height*.20,zz-length*.12],seatmat,[-.16,0,0]);box(g,'Seat cushion',[width*.43,.09,length*.18],[0,y+.035,zz],fabric);box(g,'Head rest',[width*.28,height*.20,.13],[0,y+height*.51,zz-length*.16],seatmat);for(const s of [-1,1])box(g,'Shoulder harness',[.034,height*.40,.022],[s*width*.13,y+height*.22,zz-length*.055],mat(0xbaa985,{metalness:0,roughness:.9}),[-.16,0,0]);
      const dash=box(g,'Instrument panel',[width*.62,height*.21,.085],[0,y+height*.13,zz+length*.20],fm,[-.25,0,0]);
      decal(g,'Flight instruments',{width:width*.53,height:height*.18,pos:[0,y+height*.14,zz+length*.20-.048],rot:[0,Math.PI,0],canvasWidth:512,canvasHeight:256,draw(c,w,h){c.fillStyle='#0c1419';c.fillRect(0,0,w,h);for(let j=0;j<3;j++){c.fillStyle=j===1?'#57b6b0':'#213e43';c.fillRect(w*(.07+j*.31),h*.17,w*.23,h*.60);c.strokeStyle='#a4c9bd';c.lineWidth=2;c.strokeRect(w*(.07+j*.31),h*.17,w*.23,h*.60);for(let k=0;k<4;k++){c.fillStyle='#f2e8c9';c.fillRect(w*(.09+j*.31)+k*15,h*.86,5,5);}}}});
      rod(g,'Control stick',[0,y,zz+length*.1],[0,y+height*.20,zz+length*.11],.022,fm);
      if(pilot){ellipsoid(g,'Pilot flight suit',[0,y+height*.16,zz],[width*.19,height*.22,length*.095],fabric);ellipsoid(g,'Pilot helmet',[0,y+height*.47,zz+.018],[width*.145,height*.19,width*.15],helmet);ellipsoid(g,'Dark visor',[0,y+height*.50,zz+width*.11],[width*.13,height*.085,width*.067],mat(0x12202a,{roughness:.16,metalness:.55}));for(const s of [-1,1])rod(g,'Pilot sleeve',[s*width*.16,y+height*.25,zz],[s*width*.20,y+.05,zz+length*.13],width*.065,fabric);}
    }
    const canopy=group(parent,'Opening clear canopy');canopy.userData.component='canopy';const hingeZ=z-length*.5;canopy.position.set(sideHinge?-width*.48:0,y,sideHinge?z:hingeZ);
    const localZ=sideHinge?0:length*.5,glassmat=mat(glass,{metalness:.05,roughness:.075,clearcoat:1,clearcoatRoughness:.06,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,transmission:.10,thickness:.06});
    loft(canopy,'Transparent canopy glazing',[[localZ-length*.5,.01,.01,0],[localZ-length*.36,width*.35,height*.63,0],[localZ-length*.12,width*.49,height*.96,0],[localZ+length*.15,width*.48,height,0],[localZ+length*.36,width*.31,height*.60,0],[localZ+length*.5,.01,.01,0]].map(a=>[a[0],a[1],a[2],a[3],sideHinge?width*.48:0]),glassmat,{angleStart:-Math.PI/2,angleLength:Math.PI,segments:40});
    const offsetX=sideHinge?width*.48:0;
    const rail=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*2;rail.push([offsetX+Math.cos(a)*width*.49,.004,localZ+Math.sin(a)*length*.49]);}
    const curve=new THREE.CatmullRomCurve3(rail.map(V));mesh(canopy,'Canopy perimeter seal',new THREE.TubeGeometry(curve,80,.019,6,false),fm);
    for(const f of [seats>1?-.02:-.22,.30]){const zz=localZ+length*f,ry=height*(f===.30?.79:.98),rx=width*(f===.30?.36:.485),pts=[];for(let i=0;i<=32;i++){const a=-Math.PI/2+i/32*Math.PI;pts.push(V([offsetX+Math.sin(a)*rx,Math.cos(a)*ry,zz]));}mesh(canopy,'Canopy bow frame',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,.017,6,false),fm);}
    return{group:g,canopy,setOpen(t){if(sideHinge)canopy.rotation.z=t*1.1;else canopy.rotation.x=-t*.83;}};
  }
  function exhaust(parent,{x=0,y=0,z=-5.4,r=.45,length=.65}={}){
    const g=group(parent,'Turbine exhaust nozzle');g.position.set(x,y,z);const metal=mat(0x65635f,{metalness:.92,roughness:.30}),inside=mat(0x131719,{roughness:.85,metalness:.35});
    mesh(g,'Exhaust inner duct',new THREE.CylinderGeometry(r*.85,r*.9,length,48,1,true),inside,[0,0,-length*.5],[Math.PI/2,0,0]);
    for(let i=0;i<20;i++){const a=i*Math.PI*2/20,m=box(g,'Nozzle petal',[r*.27,.045,length],[Math.sin(a)*r,Math.cos(a)*r,-length*.43],metal);m.rotation.z=-a;m.rotation.x=-Math.sin(a)*.08;m.rotation.y=Math.cos(a)*.08;}
    mesh(g,'Nozzle rim',new THREE.TorusGeometry(r,.025,6,48),chrome,[0,0,-length*.94]);
    const glow=mesh(g,'Turbine warm core',new THREE.CircleGeometry(r*.74,36),mat(0x1b120d,{emissive:0xff791f,emissiveIntensity:.08,metalness:.5,roughness:.4}),[0,0,-length*.1],[0,Math.PI,0]);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;rod(g,'Turbine blades',[0,0,-length*.13],[Math.sin(a)*r*.73,Math.cos(a)*r*.73,-length*.14],.015,metal);}return{group:g,glow};
  }
  function intake(parent,name,{x=0,y=-.5,z=1.5,width=1,height=.65,depth=1.5,color=0x8b949b}={}){
    const g=group(parent,name),metal=mat(color,{roughness:.36,metalness:.42}),mouth=mat(0x080f14,{metalness:.1,roughness:.93});
    const st=[[z-depth,width*.30,height*.40,y,x],[z-depth*.5,width*.53,height*.53,y,x],[z-.06,width*.51,height*.51,y,x],[z,width*.49,height*.48,y,x]];
    const body=loft(g,'Intake outer fairing',st,metal,{segments:48});
    const open=mesh(g,'Recessed dark inlet',new THREE.CircleGeometry(1,48),mouth,[x,y,z+.005]);open.scale.set(width*.42,height*.40,1);
    const lip=[];for(let i=0;i<=56;i++){const a=i/56*Math.PI*2;lip.push(V([x+Math.sin(a)*width*.47,y+Math.cos(a)*height*.46,z+.012]));}mesh(g,'Rolled inlet lip',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip),56,.035,8,false),metal);
    return g;
  }
  return{group,mat,mesh,box,ellipsoid,rod,line,loft,wing,fin,decal,cockpit,gear,exhaust,intake,star,usRoundel};
}
