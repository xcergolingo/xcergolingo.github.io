// Hand-built, reusable village architecture for Starry Nightrider.
// Front faces +Z. Y is up. Roof ridges run along Z, so both gable ends
// remain wall-coloured, rather than becoming red triangular roof panels.
// Static parts share geometry and materials and are safe to GPU-instance.

export function createVillageModelKit(THREE,{isMobile=false,wallTexture=null,roofTexture=null}={}){
  const TAU=Math.PI*2;
  const random=n=>{const x=Math.sin(n*127.17+93.7)*43758.545;return x-Math.floor(x);};
  const pick=(items,n)=>items[Math.floor(random(n)*items.length)];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const sharedBox=new THREE.BoxGeometry(1,1,1);
  const materialCache=new Map();
  const stoneMap=wallTexture?.clone?.()||wallTexture;
  const tilesMap=roofTexture?.clone?.()||roofTexture;
  if(stoneMap){stoneMap.repeat.set(1.55,2.15);stoneMap.needsUpdate=true;}
  if(tilesMap){tilesMap.repeat.set(2.2,2.1);tilesMap.needsUpdate=true;}

  // Subtle broad plaster strokes complement the stone atlas. The small
  // texture is created once, shared by all plaster houses, and never repainted.
  let plasterMap=stoneMap,woodMap=null,windowMap=null;
  if(typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');
    if(ctx){
      ctx.fillStyle='#d6d0be';ctx.fillRect(0,0,256,256);
      ctx.lineCap='round';
      for(let i=0;i<440;i++){
        const x=random(i+7)*256,y=random(i*7+19)*256;
        ctx.strokeStyle=pick(['#eee5cc','#c8c9bf','#b9b9b5','#e5dcc4','#c6bdac'],i+31);
        ctx.globalAlpha=.16+random(i*11+8)*.3;
        ctx.lineWidth=2+random(i+99)*3;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+3+random(i+14)*13,y-3-random(i+37)*7);ctx.stroke();
      }
      ctx.globalAlpha=1;
      plasterMap=new THREE.CanvasTexture(canvas);plasterMap.colorSpace=THREE.SRGBColorSpace;
      plasterMap.wrapS=plasterMap.wrapT=THREE.RepeatWrapping;plasterMap.repeat.set(1.6,2.8);
      plasterMap.anisotropy=isMobile?2:4;
    }
    const woodCanvas=document.createElement('canvas');woodCanvas.width=woodCanvas.height=128;
    const wg=woodCanvas.getContext('2d');
    if(wg){
      wg.fillStyle='#b6a28e';wg.fillRect(0,0,128,128);
      for(let i=0;i<100;i++){
        wg.strokeStyle=i%3?'#7d7165':'#dfc4a0';wg.globalAlpha=.18;
        wg.lineWidth=.4+random(i+67)*1.1;wg.beginPath();
        wg.moveTo(random(i+4)*128,0);wg.lineTo(random(i+4)*128+Math.sin(i)*4,128);wg.stroke();
      }
      woodMap=new THREE.CanvasTexture(woodCanvas);woodMap.colorSpace=THREE.SRGBColorSpace;
      woodMap.wrapS=woodMap.wrapT=THREE.RepeatWrapping;
    }
    const litCanvas=document.createElement('canvas');litCanvas.width=litCanvas.height=64;
    const lg=litCanvas.getContext('2d');
    if(lg){
      const glow=lg.createLinearGradient(0,0,0,64);
      glow.addColorStop(0,'#b8b0a4');glow.addColorStop(.18,'#fff7e4');glow.addColorStop(.8,'#eee2be');glow.addColorStop(1,'#aa8e70');
      lg.fillStyle=glow;lg.fillRect(0,0,64,64);
      for(let i=0;i<14;i++){
        lg.globalAlpha=.1+random(i+91)*.18;lg.fillStyle=i%3?'#a5a4a4':'#fffbed';
        lg.fillRect(i*5,0,1.5+random(i+11)*1.5,64);
      }
      windowMap=new THREE.CanvasTexture(litCanvas);windowMap.colorSpace=THREE.SRGBColorSpace;
    }
  }

  function paint(color,map=null,kind='paint'){
    const key=[color,map?.uuid||'',kind].join(':');
    if(materialCache.has(key))return materialCache.get(key);
    let mat;
    if(kind==='glass')mat=new THREE.MeshBasicMaterial({color,map,toneMapped:false});
    else if(isMobile)mat=new THREE.MeshBasicMaterial({color,map,toneMapped:false,side:THREE.DoubleSide});
    else mat=new THREE.MeshStandardMaterial({color,map,roughness:1,metalness:0,side:THREE.DoubleSide});
    materialCache.set(key,mat);return mat;
  }
  const timber=paint(0x302a35,woodMap);
  const timberEdge=paint(0x514044,woodMap);
  const windowFrame=paint(0x253344,woodMap);
  const recess=paint(0x161d32);
  const sill=paint(0xb6b8b9,stoneMap);
  const stepStone=paint(0x626b80,stoneMap);
  const chimneyMat=paint(0x8d7081,stoneMap);
  const terracotta=paint(0x984537);
  const leaf=paint(0x375d40);
  const flowerMats=[paint(0xd54a81),paint(0xad5bd2),paint(0xffbe47),paint(0xf381a1)];
  const paneMats=[paint(0xffd28a,windowMap,'glass'),paint(0xf6bd74,windowMap,'glass'),
    paint(0xe8bd8e,windowMap,'glass'),paint(0xdea568,windowMap,'glass')];

  function geometry(positions,uv){
    const result=new THREE.BufferGeometry();
    result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    result.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    result.computeVertexNormals();return result;
  }
  const gableGeometry=geometry([-.5,0,0,.5,0,0,0,1,0],[0,0,1,0,.5,1]);
  const roofPositions=[],roofUV=[];
  // Only the two tiled slopes. Gable triangles are separate wall material.
  for(const pts of [
    [[-.56,0,-.56],[-.56,0,.56],[0,1,.56],[0,1,-.56]],
    [[0,1,-.56],[0,1,.56],[.56,0,.56],[.56,0,-.56]]
  ]){
    for(const index of [0,1,2,0,2,3]){
      const p=pts[index];roofPositions.push(...p);roofUV.push((p[2]+.56)/1.12,1-p[1]);
    }
  }
  const roofGeometry=geometry(roofPositions,roofUV);
  const smallArchGeometry=(()=>{
    const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);
    shape.lineTo(.5,.13);shape.absarc(0,.13,.5,0,Math.PI,false);shape.lineTo(-.5,-.5);
    return new THREE.ShapeGeometry(shape,10);
  })();
  const paneGeometry=new THREE.PlaneGeometry(1,1);
  function framedWindowGeometry(withMullions){
    const positions=[],uv=[];
    function rectangle(x0,y0,x1,y1){
      const points=[[x0,y0,0],[x1,y0,0],[x1,y1,0],[x0,y1,0]];
      for(const index of [0,1,2,0,2,3]){
        const p=points[index];positions.push(...p);uv.push(p[0]+.5,p[1]+.5);
      }
    }
    rectangle(-.59,-.59,-.5,.59);rectangle(.5,-.59,.59,.59);
    rectangle(-.5,.5,.5,.59);rectangle(-.5,-.59,.5,-.5);
    if(withMullions){rectangle(-.025,-.5,.025,.5);rectangle(-.5,.035,.5,.075);}
    return geometry(positions,uv);
  }
  const frameGeometry=framedWindowGeometry(true);
  const simpleFrameGeometry=framedWindowGeometry(false);

  function cube(parent,w,h,d,mat,x=0,y=0,z=0,rz=0){
    const part=new THREE.Mesh(sharedBox,mat);part.position.set(x,y,z);part.scale.set(w,h,d);part.rotation.z=rz;
    // Root's batcher can treat these as ordinary unit boxes.
    parent.add(part);return part;
  }
  function prototype(parent,geo,mat,name,x,y,z,sx=1,sy=1,sz=1){
    const part=new THREE.Mesh(geo,mat);part.position.set(x,y,z);part.scale.set(sx,sy,sz);
    part.userData.staticPrototype=name;parent.add(part);return part;
  }
  function facade(root,x,y,z,rotation=0){
    const face=new THREE.Group();face.position.set(x,y,z);face.rotation.y=rotation;root.add(face);return face;
  }

  function flowerBox(parent,x,y,z,width,seed){
    cube(parent,width+.18,.27,.3,terracotta,x,y-.03,z+.13);
    cube(parent,width+.11,.08,.28,leaf,x,y+.13,z+.13);
    const count=3;
    for(let i=0;i<count;i++){
      const fm=flowerMats[(seed+i)%flowerMats.length];
      const part=cube(parent,.24+random(seed+i)*.1,.22,.24,fm,
        x+(i-(count-1)/2)*width*.31,y+.2+random(seed*3+i)*.1,z+.16);
      part.rotation.z=(random(seed+i+6)-.5)*.7;
    }
  }
  function windowOn(parent,x,y,width,height,seed,{shutters=false,flowers=false,shutterMat=timberEdge,mullion=true}={}){
    // Glass sits behind a shared dark frame silhouette and a physical sill.
    // Only three meshes per window, all batched; no Boolean holes or lamps.
    prototype(parent,paneGeometry,paneMats[Math.abs(seed)%paneMats.length],'villa-window-pane',x,y,.075,width,height,1);
    prototype(parent,mullion?frameGeometry:simpleFrameGeometry,windowFrame,
      mullion?'villa-window-frame':'villa-window-simple-frame',x,y,.12,width,height,1);
    cube(parent,width+.31,.13,.28,sill,x,y-height*.5-.08,.14);
    if(shutters){
      for(const side of [-1,1]){
        cube(parent,width*.28,height+.07,.12,shutterMat,x+side*(width*.65+.12),y,.12);
        cube(parent,width*.28,.07,.14,timberEdge,x+side*(width*.65+.12),y-height*.26,.15);
        cube(parent,width*.28,.065,.14,timberEdge,x+side*(width*.65+.12),y+height*.26,.15);
      }
    }
    if(flowers)flowerBox(parent,x,y-height*.5-.17,.18,width,seed);
  }

  function roofOn(root,width,depth,height,rise,wallMat,roofMat,{trim=true}={}){
    prototype(root,roofGeometry,roofMat,'villa-roof',0,height,0,width,rise,depth);
    for(const side of [-1,1]){
      const gable=prototype(root,gableGeometry,wallMat,'villa-gable',0,height,side*depth*.501,width,rise,1);
      if(side<0)gable.rotation.y=Math.PI;
      if(trim){
        for(const edge of [-1,1])cube(root,.135,Math.hypot(width*.56,rise),.16,timberEdge,
          edge*width*.28,height+rise*.5,side*depth*.562,edge*Math.atan2(width*.56,rise));
      }
    }
    cube(root,.16,.14,depth*1.15,timberEdge,0,height+rise+.025,0);
    for(const side of [-1,1])cube(root,.16,.16,depth*1.15,timberEdge,side*width*.557,height,0);
  }

  const defaults=[
    {width:6.0,depth:7.7,height:9.15},
    {width:5.6,depth:7.4,height:6.2},
    {width:6.3,depth:7.9,height:8.7},
    {width:5.9,depth:7.6,height:9.0},
    {width:8.1,depth:8.7,height:5.9}
  ];
  const wallPalettes=[
    [0xe7d8bc,0xd2d4d3,0xe1cccd],
    [0x4568bd,0x4468bf,0x7360b1],
    [0xc6cabc,0xbd9fc0,0xd4c0a3],
    [0xe4a249,0xc4893c,0xd7a95f],
    [0x9fae9e,0x93a6ae,0xb0b4a3]
  ];
  const roofPalettes=[
    [0x84313b,0x663143,0x933c3b],
    [0xb84735,0x9f3442,0xc24c3d],
    [0x9c3e47,0xa64a42,0x41577b],
    [0x71413d,0x923f3c,0x714758],
    [0x435a7c,0x345c7b,0x7d493f]
  ];

  function makeHouse({width,depth,height,seed=1,variant=Math.abs(seed)%5,detail=1}={}){
    seed=Number.isFinite(Number(seed))?Math.abs(Math.floor(Number(seed))):1;
    if(!Number.isFinite(Number(variant)))variant=seed%5;
    variant=Math.abs(Math.floor(variant))%5;const fallback=defaults[variant];
    width=clamp(Number(width)||fallback.width,4.5,11);
    depth=clamp(Number(depth)||fallback.depth,5,12);
    height=clamp(Number(height)||fallback.height,4.5,14.8);
    const root=new THREE.Group();root.name=['Timbered townhouse','Blue stone cottage','Painted plaster house','Ochre café','Stone farmhouse'][variant];
    const floors=height>=8.2?3:height>=5.7?2:1;
    const rise=width*(variant===1?.64:variant===4?.44:.54);
    const wallColor=pick(wallPalettes[variant],seed*3+19);
    const wallMat=paint(wallColor,variant===0||variant===2?plasterMap:stoneMap);
    const shadowTint=new THREE.Color(wallColor).multiplyScalar(.8).getHex();
    const sideMat=paint(shadowTint,variant===0||variant===2?plasterMap:stoneMap);
    const roofMat=paint(pick(roofPalettes[variant],seed*7+23),tilesMap);
    const doorMat=paint(pick([0x27564f,0x633443,0x303b60,0x79533f],seed+55),woodMap);
    const shutterMat=paint(pick([0x315b78,0x8c3d49,0x446b64,0x9d5e3a],seed+41),woodMap);

    cube(root,width,height,depth,wallMat,0,height*.5,0);
    // Two thin side-wall sheets provide baked painterly shade, cheaply.
    for(const side of [-1,1])cube(root,.028,height,depth,sideMat,side*(width*.5+.012),height*.5,0);
    cube(root,width+.08,.56,depth+.08,stepStone,0,.28,0);
    roofOn(root,width,depth,height,rise,wallMat,roofMat);
    const front=facade(root,0,0,depth*.5+.026);
    const back=facade(root,0,0,-depth*.5-.026,Math.PI);
    const left=facade(root,-width*.5-.03,0,0,-Math.PI*.5);
    const right=facade(root,width*.5+.03,0,0,Math.PI*.5);
    const storey=height/floors;
    if(variant===0)cube(root,width+.024,storey,depth+.024,
      paint(0x9caeb1,stoneMap),0,storey*.5,0);
    const paneH=Math.min(1.58,storey*.47),paneW=variant===4?1.0:1.08;

    // Every storey has its own windows. Previous houses had one pair of
    // windows floating in a tall, largely empty wall.
    for(let floor=0;floor<floors;floor++){
      const y=floor*storey+Math.min(1.9,storey*.59);
      for(const side of [-1,1]){
        windowOn(front,side*width*.29,y,paneW,paneH,seed+floor*7+side+7,{
          shutters:detail>0&&variant===2,
          flowers:detail>0&&floor>0&&(floor+seed)%2===0,shutterMat});
        windowOn(back,side*width*.27,y,paneW*.88,paneH,seed+floor*5+side+13,{mullion:detail>0});
      }
      if(detail>0){
        const sideColumns=variant===4?[-1,1]:[0];
        for(const face of [left,right])for(const side of sideColumns)
          windowOn(face,side*depth*.27,y,paneW*.92,paneH,seed+floor*11+side+21,{mullion:false});
      }
      if(floor>0&&variant!==0){
        cube(front,width+.06,.105,.12,sill,0,floor*storey,.07);
        cube(back,width+.06,.105,.12,sill,0,floor*storey,.07);
      }
    }

    // Recessed front entrance and a modest stone doorstep, correctly set
    // between the ground-floor windows, not pasted at the side of the house.
    cube(front,1.43,2.48,.13,recess,0,1.26,.07);
    cube(front,1.13,2.23,.10,doorMat,0,1.16,.15);
    cube(front,1.53,.12,.22,sill,0,2.52,.18);
    cube(front,1.74,.17,.65,stepStone,0,.085,.31);
    cube(front,.075,.11,.06,paint(0xd9aa5d),.36,1.18,.225);
    cube(front,.9,.33,.04,paneMats[seed%paneMats.length],0,1.94,.215);

    if(variant===0){
      for(const face of [front,back]){
        for(const x of [-width*.48,0,width*.48])cube(face,.15,height,.15,timber,x,height*.5,.17);
        for(let f=0;f<=floors;f++)cube(face,width,.17,.15,timber,0,f*storey+.04,.17);
        for(let f=1;f<floors;f++)for(const side of [-1,1]){
          const dx=side*width*.22,dy=storey*.62;
          cube(face,.12,Math.hypot(dx,dy),.14,timber,side*width*.115,f*storey+storey*.53,.18,-Math.atan2(dx,dy));
        }
        cube(face,.14,rise,.14,timber,0,height+rise*.5,.17);
        cube(face,width*.7,.13,.14,timber,0,height+rise*.28,.17);
      }
      if(detail>0)for(const face of [left,right]){
        for(const x of [-depth*.48,0,depth*.48])cube(face,.15,height,.13,timber,x,height*.5,.15);
        for(let f=1;f<=floors;f++)cube(face,depth,.16,.13,timber,0,f*storey,.15);
      }
    }else{
      // Simple contrasting corner quoins distinguish stonework from plaster.
      if(detail>0)for(const face of [front,back])for(const side of [-1,1])
        cube(face,.27,height,.15,sill,side*(width*.5-.1),height*.5,.09);
    }

    // Small attic window sits in wall-coloured gable, below the red ridge.
    const attic=prototype(front,smallArchGeometry,recess,'villa-arch-reveal',0,height+rise*.32,.07,.95,1.2,1);
    prototype(front,smallArchGeometry,paneMats[(seed+1)%4],'villa-arch-pane',0,height+rise*.32,.09,.71,.97,1);
    cube(front,.05,.83,.09,windowFrame,0,height+rise*.32,.13);
    // A little exterior lintel avoids looking like a floating lit sticker.
    cube(front,1.08,.12,.2,sill,0,height+rise*.32-.61,.13);
    attic.userData.part='attic-window';

    if(variant===3){
      // An ochre café: a correctly sloping striped awning and canvas valance.
      // No per-house text textures or runtime canvases are required.
      const awning=new THREE.Group();awning.position.set(0,2.85,depth*.5+.67);
      awning.rotation.x=.23;root.add(awning);
      const stripeMats=[paint(0xd6ad77),paint(0x884341)];
      const stripeCount=9,awningW=width*.86;
      for(let i=0;i<stripeCount;i++){
        const x=(i-(stripeCount-1)/2)*awningW/stripeCount;
        cube(awning,awningW/stripeCount+.012,.07,1.32,stripeMats[i%2],x,0,0);
        cube(awning,awningW/stripeCount+.012,.24,.07,stripeMats[i%2],x,-.13,.66);
      }
      for(const side of [-1,1])cube(root,.07,2.62,.07,timber,side*width*.42,1.31,depth*.5+1.2);
    }

    const chimneyY=height+rise*.53;
    cube(root,.67,1.9,.72,chimneyMat,width*.27,chimneyY+.6,-depth*.2);
    cube(root,.86,.17,.89,sill,width*.27,chimneyY+1.59,-depth*.2);
    cube(root,.58,.045,.58,recess,width*.27,chimneyY+1.69,-depth*.2);

    if(detail>0&&(variant===0||variant===3)&&seed%2===0){
      // One small dormer intersects a roof slope; it is not a floating hut.
      const dormer=facade(root,-width*.32,height+rise*.36,-depth*.08,-Math.PI*.5);
      cube(dormer,1.32,1.02,1.38,wallMat,0,.51,0);
      roofOn(dormer,1.32,1.38,1.02,.81,wallMat,roofMat,{trim:false});
      const face=facade(dormer,0,0,.70);
      windowOn(face,0,.55,.66,.67,seed+17,{mullion:false});
    }
    root.userData.dimensions={width,depth,height,rise,
      totalHeight:Math.max(height+rise+.15,chimneyY+1.7125)};
    root.userData.variant=variant;root.userData.frontDirection='+Z';
    return root;
  }

  return{makeHouse,materials:materialCache,geometries:{box:sharedBox,roof:roofGeometry,gable:gableGeometry}};
}
