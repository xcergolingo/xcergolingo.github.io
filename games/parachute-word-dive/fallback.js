// A complete Canvas2D flight view for browsers that disable hardware WebGL.
// Game rules and controls are identical to the Three.js version.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const seeded=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};

function makeMap(){
  const c=document.createElement('canvas');c.width=c.height=2000;const ctx=c.getContext('2d'),rnd=seeded(1996);
  ctx.fillStyle='#778a7a';ctx.fillRect(0,0,2000,2000);
  for(let i=0;i<300;i++){
    ctx.fillStyle=['#5c806d','#799682','#8e9f84','#6a917f','#9aa390'][Math.floor(rnd()*5)];
    const x=rnd()*2000,y=rnd()*2000;ctx.fillRect(x,y,20+rnd()*180,20+rnd()*120);
  }
  const cell=66;
  for(let y=0;y<2000;y+=cell)for(let x=0;x<2000;x+=cell){
    const shade=['#aab4aa','#9ca8aa','#c5c1ad','#a79e8e','#8b999b','#8c9a94','#d1c6ac'][Math.floor(rnd()*7)];
    ctx.fillStyle=shade;ctx.fillRect(x+6,y+7,cell-13,cell-14);
    const n=1+Math.floor(rnd()*5);
    for(let k=0;k<n;k++){
      const bx=x+10+rnd()*38,by=y+10+rnd()*37,bw=8+rnd()*16,bh=7+rnd()*16;
      ctx.fillStyle='#59696844';ctx.fillRect(bx+3,by+4,bw,bh);
      ctx.fillStyle=['#f0ead4','#718d92','#6e8788','#a4b1b0','#857f7c'][Math.floor(rnd()*5)];ctx.fillRect(bx,by,bw,bh);
      ctx.strokeStyle='#ffffff22';ctx.lineWidth=.7;ctx.strokeRect(bx,by,bw,bh);
    }
  }
  ctx.fillStyle='#58686d';for(let x=0;x<2000;x+=cell)ctx.fillRect(x,0,9,2000);
  for(let y=0;y<2000;y+=cell)ctx.fillRect(0,y,2000,9);
  ctx.strokeStyle='#cfcbba90';ctx.lineWidth=1.1;ctx.setLineDash([7,11]);
  for(let x=0;x<2000;x+=cell){ctx.beginPath();ctx.moveTo(x+4,0);ctx.lineTo(x+4,2000);ctx.stroke();}
  for(let y=0;y<2000;y+=cell){ctx.beginPath();ctx.moveTo(0,y+4);ctx.lineTo(2000,y+4);ctx.stroke();}
  ctx.setLineDash([]);
  // Curving blue river and highways make the city readable from the air.
  ctx.strokeStyle='#bbcabf';ctx.lineWidth=72;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-70,570);ctx.bezierCurveTo(430,370,610,710,1060,565);ctx.bezierCurveTo(1530,435,1700,570,2050,360);ctx.stroke();
  ctx.strokeStyle='#5395a4';ctx.lineWidth=53;ctx.stroke();
  ctx.lineCap='butt';ctx.strokeStyle='#dedbc1';ctx.lineWidth=27;ctx.beginPath();ctx.moveTo(-60,1490);ctx.bezierCurveTo(530,1375,640,1040,990,1020);ctx.bezierCurveTo(1530,950,1740,790,2110,710);ctx.stroke();
  ctx.strokeStyle='#656f71';ctx.lineWidth=19;ctx.stroke();
  ctx.fillStyle='#63896e';ctx.beginPath();ctx.ellipse(1260,1250,170,125,-.25,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#598e62';ctx.beginPath();ctx.ellipse(790,810,110,90,.25,0,Math.PI*2);ctx.fill();
  for(let i=0;i<150;i++){
    const a=rnd()*6.283,r=Math.sqrt(rnd())*158,x=1260+Math.cos(a)*r,y=1250+Math.sin(a)*r;
    ctx.fillStyle=rnd()<.5?'#285d4f':'#466d56';ctx.beginPath();ctx.arc(x,y,2+rnd()*5,0,6.283);ctx.fill();
  }
  ctx.save();ctx.translate(550,1180);ctx.rotate(-.22);
  ctx.fillStyle='#d0d5cb';ctx.beginPath();ctx.ellipse(0,0,110,77,0,0,6.283);ctx.fill();
  ctx.fillStyle='#648d6b';ctx.beginPath();ctx.ellipse(0,0,90,56,0,0,6.283);ctx.fill();
  for(let i=0;i<4;i++){ctx.strokeStyle=i%2?'#a3aaa6':'#c9cdc2';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,0,99-i*7,64-i*5,0,0,6.283);ctx.stroke();}
  ctx.restore();
  // Airport runway and docks on the east side.
  ctx.fillStyle='#687477';ctx.fillRect(1570,170,340,190);ctx.fillStyle='#ddd7bd';ctx.fillRect(1590,263,300,5);
  ctx.setLineDash([22,20]);ctx.strokeStyle='#f6ecd1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(1595,266);ctx.lineTo(1890,266);ctx.stroke();ctx.setLineDash([]);
  return c;
}

function strokeRoundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.stroke();}
function fillRoundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}

// The compatibility renderer uses an actual pinhole camera. The aerial photo is
// projected onto the ground plane a few screen pixels at a time. It now changes
// perspective and scale naturally with altitude instead of being a still image.
function makeCamera(game,mode,w,h){
  const alt=game.phase==='ready'?1750:game.alt;
  const descent=clamp(1-alt/1750,0,1);
  const overhead=mode==='overhead';
  const fov=(w/h<.78?81:70)*Math.PI/180;
  return {
    x:game.phase==='ready'?0:game.x,
    y:alt+(overhead?235:66),
    z:(game.phase==='ready'?1500:game.z)+(overhead?156:185)+clamp((game.vz||-28)+28,-85,85)*.15,
    pitch:overhead?1.02:.31+descent*.058,
    f:h/(2*Math.tan(fov/2)),w,h
  };
}
function project3D(camera,x,y,z){
  const dx=x-camera.x,dy=y-camera.y,dz=z-camera.z;
  const sin=Math.sin(camera.pitch),cos=Math.cos(camera.pitch);
  const depth=-dy*sin-dz*cos;
  if(depth<=4)return null;
  const factor=camera.f/depth;
  return {x:camera.w*.5+dx*factor,y:camera.h*.5-(dy*cos-dz*sin)*factor,depth,scale:factor};
}
function quad(ctx,points,fill){
  if(points.some(p=>!p))return;
  ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.closePath();ctx.fill();
}
function makeBuildings(){
  const rand=seeded(298527),list=[];
  const palette=[['#879a9e','#657781','#9ba8a6'],['#b4b5a8','#838e8d','#c6c9bb'],['#78939b','#4d6776','#9aaeb1'],['#b3a79b','#8f857d','#d3c2b1'],['#8fa098','#687c76','#a5b6aa']];
  for(let iz=-10;iz<=9;iz++)for(let ix=-13;ix<=13;ix++){
    if(rand()<.44)continue;
    const x=ix*122+(rand()-.5)*41,z=iz*119-440+(rand()-.5)*44;
    const downtown=Math.exp(-((x/480)**2)-(((z+470)/420)**2));
    const h=14+rand()*34+downtown*(rand()*80)+(downtown>.32&&rand()>.79?80+rand()*170:0);
    const colors=palette[Math.floor(rand()*palette.length)];
    list.push({x,z,h,w:23+rand()*39,d:24+rand()*44,colors,windows:h>70});
  }
  for(let i=0;i<30;i++){
    const a=i*2.399,r=Math.sqrt(i+1)*65;
    const x=Math.cos(a)*r,z=-390+Math.sin(a)*r;
    const colors=palette[Math.floor(rand()*palette.length)];
    list.push({x,z,h:140+rand()*270,w:27+rand()*37,d:28+rand()*39,colors,windows:true});
  }
  return list;
}

export class CanvasWorld{
  constructor(container){
    this.container=container;this.cameraMode='chase';this.renderer={domElement:document.createElement('canvas')};
    this.renderer.domElement.className='fallback-canvas';this.renderer.domElement.setAttribute('aria-label','Parachute word dive flight view');
    container.append(this.renderer.domElement);this.ctx=this.renderer.domElement.getContext('2d',{alpha:false});
    this.map=makeMap();this.buildings=makeBuildings();this.rings=[];this.screenRings=[];this.particles=[];this.time=0;this.frameTime=0;this.width=0;this.height=0;
    this.skyline=new Image();this.skyline.src='./assets/coastal-skyline.webp';
    this.mapPhoto=new Image();this.mapPhoto.src='./assets/coastal-map.webp';
    this.diverPhoto=new Image();this.diverPhoto.src='./assets/skydiver-cutout.webp';
    this.chutePhoto=new Image();this.chutePhoto.src='./assets/skydiver-canopy-pose.webp';
    this.resize();
  }
  resize(){
    const dpr=Math.min(devicePixelRatio||1,1.8);this.width=Math.max(1,this.container.clientWidth);this.height=Math.max(1,this.container.clientHeight);
    this.renderer.domElement.width=Math.round(this.width*dpr);this.renderer.domElement.height=Math.round(this.height*dpr);
    this.renderer.domElement.style.width=this.width+'px';this.renderer.domElement.style.height=this.height+'px';
    this.ctx.setTransform(dpr,0,0,dpr,0,0);this.dpr=dpr;
  }
  setRings(rings){this.rings=rings.map(r=>({...r}));}
  pickRing(clientX,clientY){
    const rect=this.renderer.domElement.getBoundingClientRect();const x=clientX-rect.left,y=clientY-rect.top;
    let selected=null,best=66;
    for(const ring of this.screenRings){
      const d=Math.min(Math.hypot(x-ring.x,y-ring.y),Math.hypot(x-ring.x,y-(ring.y-ring.radius-36)));
      if(d<best){best=d;selected=ring.id;}
    }
    return selected;
  }
  resetCamera(){}
  onNewFlight(){this.particles=[];}
  toggleCamera(){this.cameraMode=this.cameraMode==='chase'?'overhead':'chase';}
  burst(x,y,z){for(let i=0;i<24;i++)this.particles.push({x,y,z,dx:(Math.random()-.5)*150,dy:(Math.random()-.5)*150,life:1});}

  drawPilot(ctx,game,cx,cy){
    ctx.save();ctx.translate(cx,cy);
    const bank=clamp(-game.vx/170,-.40,.40);
    const forwardPitch=clamp((-(game.vz||-28)-28)/88,-.72,.72);
    ctx.rotate(bank+Math.sin(this.time*1.65)*.017);
    const chute=['chute','paused-chute'].includes(game.phase)||game.phase==='landed';
    if(!chute&&this.diverPhoto.complete&&this.diverPhoto.naturalWidth){
      const size=clamp(this.width*.12,82,154)*(1+Math.sin(this.time*1.9)*.014);
      ctx.scale(1+Math.abs(bank)*.16-forwardPitch*.03,1-Math.abs(bank)*.13+forwardPitch*.1);
      ctx.shadowColor='#25344277';ctx.shadowBlur=8;ctx.shadowOffsetY=5;
      ctx.drawImage(this.diverPhoto,-size/2,-size*.54,size,size*.915);
      ctx.restore();return;
    }
    const bodyScale=Math.max(.62,Math.min(.96,this.width/850));ctx.scale(bodyScale,bodyScale);
    ctx.shadowColor='#0c394f91';ctx.shadowBlur=14;ctx.shadowOffsetY=5;
    if(chute){
      ctx.save();ctx.translate(0,-125);ctx.scale(clamp(game.chuteScale||.2,.12,1),clamp(game.chuteScale||.2,.12,1));
      const spans=16,palette=['#e97769','#f9c38c','#fff2d8','#51c4b6','#198ba5','#d8f5ea','#ffe3a2','#e76f67','#ffe5aa','#44b9b1','#20849b','#f2f0d8'];
      for(let j=0;j<spans;j++){
        const xl=-220+j*(440/spans),xr=xl+440/spans;
        ctx.fillStyle=palette[j%palette.length];ctx.beginPath();ctx.moveTo(xl,0);
        ctx.bezierCurveTo(xl*.94,-105+Math.abs(xl)*.11,xr*.94,-105+Math.abs(xr)*.11,xr,0);
        ctx.lineTo(xr*.84,36);ctx.lineTo(xl*.84,36);ctx.closePath();ctx.fill();
      }
      ctx.strokeStyle='#effff2bb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-220,0);ctx.quadraticCurveTo(0,-115,220,0);ctx.stroke();
      ctx.restore();
      ctx.strokeStyle='#f9f9eab5';ctx.lineWidth=1.8;for(const x of [-185,-150,-115,-80,-45,45,80,115,150,185]){
        const gripX=x<0?-39:39;
        ctx.beginPath();ctx.moveTo(x,-89);ctx.lineTo(gripX,-30);ctx.stroke();
      }
      ctx.shadowBlur=0;
    }
    if(chute&&this.chutePhoto.complete&&this.chutePhoto.naturalWidth){
      // Same photographic jumper, matching T-shirt, hair, harness and boots;
      // only the posture changes when the parachute takes his weight.
      const height=clamp(this.width*.18,135,180),width=height*2/3;
      ctx.shadowColor='#17303c90';ctx.shadowBlur=8;ctx.shadowOffsetY=4;
      ctx.drawImage(this.chutePhoto,-width/2,-46,width,height);
      ctx.restore();return;
    }
    // Spread legs and arms, then harness, jacket, gloves and a helmet seen from above.
    const armSpread=chute?13:29;
    ctx.strokeStyle='#535b5d';ctx.lineWidth=12;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-9,19);ctx.lineTo(-20,49);ctx.lineTo(-28,63);ctx.moveTo(9,19);ctx.lineTo(20,49);ctx.lineTo(28,63);ctx.stroke();
    ctx.strokeStyle='#403a35';ctx.lineWidth=14;ctx.beginPath();ctx.moveTo(-29,64);ctx.lineTo(-25,77);ctx.moveTo(29,64);ctx.lineTo(25,77);ctx.stroke();
    ctx.strokeStyle='#dbd8d0';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(-15,-12);ctx.lineTo(-armSpread,-1);ctx.lineTo(-armSpread-13,13);ctx.moveTo(15,-12);ctx.lineTo(armSpread,-1);ctx.lineTo(armSpread+13,13);ctx.stroke();
    ctx.strokeStyle='#bb947b';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-armSpread-13,13);ctx.lineTo(-armSpread-20,20);ctx.moveTo(armSpread+13,13);ctx.lineTo(armSpread+20,20);ctx.stroke();
    ctx.fillStyle='#dad7d0';ctx.beginPath();ctx.moveTo(-14,-20);ctx.quadraticCurveTo(0,-27,14,-20);ctx.lineTo(17,21);ctx.lineTo(-17,21);ctx.closePath();ctx.fill();
    ctx.fillStyle='#41484b';fillRoundRect(ctx,-15,-14,30,34,7);
    ctx.fillStyle='#596365';fillRoundRect(ctx,-11,-10,22,25,5);
    ctx.strokeStyle='#cec7ba';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,-13);ctx.lineTo(9,18);ctx.moveTo(15,-13);ctx.lineTo(-9,18);ctx.stroke();
    ctx.fillStyle='#e6c39c';ctx.beginPath();ctx.arc(0,-29,12,0,6.283);ctx.fill();
    ctx.fillStyle='#383733';ctx.beginPath();ctx.arc(0,-33,12.5,Math.PI,6.283);ctx.lineTo(12,-30);ctx.lineTo(-12,-30);ctx.fill();
    ctx.restore();
  }

  drawPerspectiveGround(ctx,cam){
    const img=this.mapPhoto.complete&&this.mapPhoto.naturalWidth?this.mapPhoto:this.map;
    const w=this.width,h=this.height,step=h>1050?5:4;
    const horizon=h*.5-cam.f*Math.tan(cam.pitch);
    ctx.save();
    for(let row=Math.max(0,Math.floor(horizon));row<h;row+=step){
      const angle=cam.pitch+Math.atan2(row+step*.5-h*.5,cam.f);
      if(angle<=.035)continue;
      const forward=cam.y/Math.tan(angle);
      const worldZ=cam.z-forward;
      const sy=(worldZ+3800)/7000*img.height;
      const nextAngle=cam.pitch+Math.atan2(row+step*1.5-h*.5,cam.f);
      const nextZ=cam.z-cam.y/Math.tan(nextAngle);
      const sh=clamp((nextZ-worldZ)/7000*img.height,1,48);
      const half=cam.y/Math.sin(angle)*w/(cam.f*2);
      const sx0=(cam.x-half+3500)/7000*img.width;
      const sx1=(cam.x+half+3500)/7000*img.width;
      const localY=((sy%img.height)+img.height)%img.height;
      ctx.globalAlpha=clamp((row-horizon)/(h*.47),0,1);
      // Repeat the terrain beyond the map edges so there is no rectangular
      // photographic cut-out suspended over the horizon.
      const firstTile=Math.floor(sx0/img.width),lastTile=Math.floor(sx1/img.width);
      for(let tile=firstTile;tile<=lastTile;tile++){
        const left=Math.max(sx0,tile*img.width),right=Math.min(sx1,(tile+1)*img.width);
        if(right-left<.01)continue;
        const destLeft=(left-sx0)/(sx1-sx0)*w;
        const destWidth=(right-left)/(sx1-sx0)*w;
        ctx.drawImage(img,left-tile*img.width,localY,right-left,Math.min(sh,img.height-localY),destLeft,row,destWidth,step+1);
      }
    }
    ctx.restore();
  }

  drawBuildings(ctx,cam){
    const visible=[];
    for(const b of this.buildings){
      const p=project3D(cam,b.x,b.h*.5,b.z);
      if(!p||p.depth>5100)continue;
      const extent=cam.f*(b.h+b.w+b.d)/Math.max(p.depth,35);
      if(p.x+extent< -90||p.x-extent>cam.w+90||p.y+extent< -90||p.y-extent>cam.h+90)continue;
      visible.push({b,depth:p.depth});
    }
    visible.sort((a,b)=>b.depth-a.depth);
    for(const entry of visible){
      const {b,depth}=entry;
      const x1=b.x-b.w*.5,x2=b.x+b.w*.5,z1=b.z-b.d*.5,z2=b.z+b.d*.5;
      const a=project3D(cam,x1,0,z2),d=project3D(cam,x2,0,z2);
      const A=project3D(cam,x1,b.h,z2),D=project3D(cam,x2,b.h,z2);
      const B=project3D(cam,x1,b.h,z1),C=project3D(cam,x2,b.h,z1);
      const sideX=cam.x<b.x?x1:x2;
      const S0=project3D(cam,sideX,0,z1),S1=project3D(cam,sideX,0,z2);
      const S2=project3D(cam,sideX,b.h,z2),S3=project3D(cam,sideX,b.h,z1);
      const fog=clamp((4200-depth)/2200,.16,.98);
      ctx.save();ctx.globalAlpha=fog;
      quad(ctx,[S0,S1,S2,S3],b.colors[1]);
      quad(ctx,[a,d,D,A],b.colors[0]);
      quad(ctx,[B,C,D,A],b.colors[2]);
      if(b.windows&&A&&D&&a&&d){
        const apparentHeight=Math.max(Math.abs(A.y-a.y),Math.abs(D.y-d.y));
        const apparentWidth=Math.abs(D.x-A.x);
        if(depth<2200&&apparentHeight>30&&apparentWidth>8){
          const cols=clamp(Math.floor(b.w/8),2,7),floors=clamp(Math.floor(b.h/11),4,34);
          const drawEvery=Math.max(1,Math.ceil(floors/22));
          ctx.fillStyle='#dbe5db99';
          for(let r=1;r<floors;r+=drawEvery){
            const yy=b.h*r/floors;
            const l=project3D(cam,x1,yy,z2+.12),rr=project3D(cam,x2,yy,z2+.12);
            if(!l||!rr)continue;
            const width=(rr.x-l.x)/cols;
            if(width<2)break;
            for(let c=0;c<cols;c++){
              if((r*13+c*7+Math.floor(b.x))%5===0)continue;
              const winX=l.x+(c+.18)*width;
              const winY=l.y+(rr.y-l.y)*(c+.5)/cols;
              ctx.fillRect(winX,winY,Math.max(1,width*.55),clamp(yy*.002+1.2,1,2.2));
            }
          }
        }
      }
      ctx.restore();
    }
  }

  update(game,dt){
    this.time+=dt;this.frameTime+=dt;
    if(this.frameTime<1/30)return;
    this.frameTime=0;
    const w=this.width,h=this.height,ctx=this.ctx;
    const alt=game.phase==='ready'?1750:game.alt;
    const x=game.phase==='ready'?0:game.x,z=game.phase==='ready'?1500:game.z;
    const cam=makeCamera(game,this.cameraMode,w,h);
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#6fa4ce');sky.addColorStop(.48,'#b6d1dc');sky.addColorStop(.8,'#becacd');sky.addColorStop(1,'#91a8a7');
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    // Only the distant horizon is static; the roads, city and buildings now
    // move independently with the camera as the player actually descends.
    if(this.skyline.complete&&this.skyline.naturalWidth){
      const img=this.skyline;
      const naturalScale=Math.max(w/img.width,h/img.height)*1.03;
      const iw=img.width*naturalScale,ih=img.height*naturalScale;
      const horizonY=h*.5-cam.f*Math.tan(cam.pitch);
      const dx=clamp(-(cam.x)*.036,-100,100)+Math.sin(this.time*.04)*4;
      ctx.drawImage(img,(w-iw)/2+dx,horizonY-ih*.555,iw,ih);
    }
    this.drawPerspectiveGround(ctx,cam);
    this.drawBuildings(ctx,cam);
    const horizonY=h*.5-cam.f*Math.tan(cam.pitch);
    const atmospheric=ctx.createLinearGradient(0,Math.max(0,horizonY-45),0,Math.max(1,horizonY+h*.35));
    atmospheric.addColorStop(0,'rgba(207,217,219,.20)');atmospheric.addColorStop(.42,'rgba(203,218,222,.09)');atmospheric.addColorStop(1,'rgba(201,211,213,0)');
    ctx.fillStyle=atmospheric;ctx.fillRect(0,Math.max(0,horizonY-45),w,h*.55);
    // Wispy near-camera clouds race downward while the far horizon stays put.
    for(let i=0;i<8;i++){
      const proximity=.4+(i%4)*.26;
      const ox=((i*237.3+this.time*(7+i*2.8))%(w+390))-210-cam.x*.016*proximity;
      const oy=((i*143.1+this.time*(5+i*4.1))%(h+280))-145;
      const opacity=(.012+.06*Math.sin(i*17.43)**2)*(1-clamp(1-alt/1750,0,1)*.6);
      ctx.fillStyle=`rgba(248,254,253,${opacity})`;
      for(let j=0;j<5;j++){ctx.beginPath();ctx.ellipse(ox+j*24,oy+Math.sin(j*2.3)*11,68-j*4,20+j*3,.1,0,6.283);ctx.fill();}
    }
    const landing=project3D(cam,0,-3,-650);
    if(alt<650&&landing){
      const radius=clamp(60*landing.scale,8,100);
      ctx.save();ctx.translate(landing.x,landing.y);ctx.strokeStyle='#b9ffce';ctx.lineWidth=2;ctx.shadowColor='#58ffb1';ctx.shadowBlur=12;
      for(const rr of [1,.72,.36]){ctx.beginPath();ctx.ellipse(0,0,radius*rr,radius*rr*.63,0,0,6.283);ctx.stroke();}
      ctx.font='800 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#e2ffdb';ctx.fillText('LAND HERE',0,-radius*.8-10);ctx.restore();
    }
    this.screenRings=[];
    for(let i=0;i<this.rings.length;i++){
      const ring=this.rings[i],p=project3D(cam,ring.x,ring.y,ring.z);
      if(!p)continue;
      const r=clamp(28*p.scale,14,53);
      this.screenRings.push({id:ring.id,x:p.x,y:p.y,radius:r});
      ctx.save();ctx.translate(p.x,p.y);const pulse=1+Math.sin(this.time*3.2+i)*.025;
      const picked=game.easy&&game.glideTarget===ring.id;
      ctx.scale(pulse,pulse*.48);ctx.shadowBlur=7;ctx.shadowColor=picked?'#ffe3a4':'#52ffe0';ctx.strokeStyle=picked?'#ffe2a1':'#a8ffeb';ctx.lineWidth=1.15;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
      ctx.lineWidth=.7;ctx.strokeStyle='#effff880';ctx.beginPath();ctx.arc(0,0,r+3,0,6.283);ctx.stroke();ctx.restore();
      const label=ring.word;
      ctx.save();const ww=Math.min(Math.max(70,22+[...label].length*10),165),lh=28;
      ctx.translate(p.x,p.y-r*.64-34);ctx.fillStyle='#073949e2';ctx.strokeStyle='#b3ffe3bd';ctx.lineWidth=1.1;
      fillRoundRect(ctx,-ww/2,0,ww,lh,10);strokeRoundRect(ctx,-ww/2,0,ww,lh,10);
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#effff4';ctx.font=`800 ${[...label].length>12?12:14}px system-ui,sans-serif`;
      ctx.fillText(label,0,lh/2,ww-13);ctx.restore();
    }
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];p.life-=dt*1.25;
      if(p.life<=0){this.particles.splice(i,1);continue;}
      const pos=project3D(cam,p.x,p.y,p.z);
      if(!pos)continue;
      ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle=i%2?'#9affcb':'#ffdf9d';ctx.beginPath();ctx.arc(pos.x+p.dx*(1-p.life),pos.y+p.dy*(1-p.life),3.5*p.life,0,6.283);ctx.fill();ctx.globalAlpha=1;
    }
    const player=project3D(cam,x,alt,z),cx=player?.x??w/2,cy=player?.y??h*.55;
    // A small departure plane exits the frame at the start of the flight.
    if(game.phase==='ready'||game.elapsed<8){
      ctx.save();ctx.translate(cx-160+this.time*9,cy-210-this.time*2);ctx.rotate(-.25);ctx.globalAlpha=.65;
      ctx.fillStyle='#eaf4e7';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(4,-6);ctx.lineTo(44,1);ctx.lineTo(44,8);ctx.lineTo(5,6);ctx.lineTo(2,31);ctx.lineTo(-2,31);ctx.lineTo(-5,6);ctx.lineTo(-44,8);ctx.lineTo(-44,1);ctx.lineTo(-4,-6);ctx.closePath();ctx.fill();
      ctx.restore();
    }
    this.drawPilot(ctx,game,cx,cy);
    // Cinematic edge vignette, subtle enough to keep the streets visible.
    const vignette=ctx.createRadialGradient(cx,cy,Math.min(w,h)*.25,cx,cy,Math.max(w,h)*.78);
    vignette.addColorStop(0,'rgba(10,38,49,0)');vignette.addColorStop(1,'rgba(8,35,50,.18)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }
}
