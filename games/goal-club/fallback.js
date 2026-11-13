import * as THREE from './vendor/three.module.js';
import { configureCamera } from './camera.js';

// Canvas compatibility renderer. Projection, obstacles and moving-object
// coordinates match WebGL; the same game rules run with either renderer.
export function createFallbackWorld(canvas) {
  const mainCtx = canvas.getContext('2d', { alpha: false });
  if (!mainCtx) throw new Error('This browser cannot create a game canvas.');
  const backdrop = document.createElement('canvas');
  const backdropCtx = backdrop.getContext('2d', { alpha: false });
  let ctx = mainCtx, sceneryDirty = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, .1, 160);
  const ball = new THREE.Group(), player = new THREE.Group(), goal = new THREE.Group(), particles = new THREE.Group();
  ball.scale.setScalar(.9); player.scale.setScalar(1.18);
  scene.add(ball, player, goal, particles);
  const defenders = [], obstacles = [], actors = [];
  const challenge = { startX: 0, startZ: 8, goalX: 0, goalWidth: 7 };
  let width = 1, height = 1, density = 1, theme = 0, clock = 0, kickPose = -1, cheerPose = -1, shotStyle = 'curl';
  let netImpact = null, charge = null;
  const aim = { x: 0, bend: 0, power: .72, style: 'curl' };
  const clamp = THREE.MathUtils.clamp, mix = THREE.MathUtils.lerp;
  const smooth = value => { const t=clamp(value,0,1); return t*t*(3-2*t); };
  const noise = value => { const n=Math.sin(value*127.1+311.7)*43758.5453; return n-Math.floor(n); };
  const projection = new THREE.Vector3(), matrix = new THREE.Matrix4(), point = new THREE.Vector3(), color = new THREE.Color();
  const shades = new Map();
  function shade(hex, factor) {
    const key = `${hex}:${factor}`;
    if (!shades.has(key)) { const c = new THREE.Color(hex); c.multiplyScalar(factor); shades.set(key, `#${c.getHexString()}`); }
    return shades.get(key);
  }
  function project(v) {
    if (Array.isArray(v)) projection.fromArray(v); else projection.copy(v);
    projection.project(camera);
    return { x: (projection.x * .5 + .5) * width, y: (-projection.y * .5 + .5) * height, visible: projection.z > -1 && projection.z < 1 && Math.abs(projection.x) < 1.35 && Math.abs(projection.y) < 1.35 };
  }
  function unitAt(x, y, z) {
    const a = project([x - .5, y, z]), b = project([x + .5, y, z]);
    return Math.max(.1, Math.min(height * 3, Math.hypot(b.x - a.x, b.y - a.y)));
  }
  function depth(p) {
    const m = camera.matrixWorldInverse.elements;
    return -(m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]);
  }
  function nearIntersection(a,b,da,db) {
    const t=(.12-da)/(db-da);
    return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  }
  function clippedPolygon(points) {
    const output=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],da=depth(a),db=depth(b);
      if(da>=.12)output.push(a);
      if((da>=.12)!==(db>=.12))output.push(nearIntersection(a,b,da,db));
    }
    return output;
  }
  function resize(w, h) {
    width = Math.max(1, w); height = Math.max(1, h); density = Math.min(window.devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
    configureCamera(camera, width, height, challenge); sceneryDirty = true;
  }
  function polygon(points, fill, stroke = null, strokeWidth = 1) {
    const clipped=clippedPolygon(points);if(clipped.length<3)return;
    ctx.beginPath(); clipped.forEach((p, i) => { const s = project(p); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.stroke(); }
  }
  function line(points, stroke, thickness, closed = false) {
    const count = points.length + (closed ? 1 : 0);
    ctx.strokeStyle = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < count; i++) {
      let a = points[i - 1], b = points[i % points.length];
      const da=depth(a),db=depth(b);if(da<.12&&db<.12)continue;
      if(da<.12)a=nearIntersection(a,b,da,db);else if(db<.12)b=nearIntersection(a,b,da,db);
      const pa = project(a), pb = project(b);
      ctx.lineWidth = Math.max(.5, thickness * unitAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2));
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
  }
  function rect(x, z, w, d, fill, y = .025) { polygon([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]],fill); }
  function ring(x,z,radius,fill,thickness=.07,y=.045,start=0,end=Math.PI*2) {
    const pts=[];for(let i=0;i<=48;i++){const a=start+(end-start)*i/48;pts.push([x+Math.cos(a)*radius,y,z+Math.sin(a)*radius]);}line(pts,fill,thickness);
  }
  function ellipse(x,y,rx,ry,fill,stroke=null,thickness=1) {
    ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=thickness;ctx.stroke();}
  }
  function block(x,y,z,w,h,d,fill,side=null,top=null) {
    const left=x-w/2,right=x+w/2,back=z-d/2,front=z+d/2,sideFill=side||shade(fill,.73);
    if(camera.position.x>x)polygon([[right,y,back],[right,y,front],[right,y+h,front],[right,y+h,back]],shade(fill,.84));
    else polygon([[left,y,back],[left,y,front],[left,y+h,front],[left,y+h,back]],sideFill);
    polygon([[left,y,front],[right,y,front],[right,y+h,front],[left,y+h,front]],sideFill);
    polygon([[left,y+h,back],[right,y+h,back],[right,y+h,front],[left,y+h,front]],top||fill);
  }
  function groundShadow(x,z,rx=.6,rz=.55,opacity=.22) {
    const pts=[];for(let i=0;i<20;i++){const a=i*Math.PI/10;pts.push([x+Math.cos(a)*rx,.032,z+Math.sin(a)*rz]);}
    ctx.save();ctx.globalAlpha=opacity;polygon(pts,theme===2?'#555b50':'#334b18');ctx.restore();
  }
  function paintPitch() {
    const sky=ctx.createLinearGradient(0,0,0,height*.55);
    sky.addColorStop(0,theme===2?'#9badb3':'#a8c2c8');sky.addColorStop(.7,'#d7ded2');sky.addColorStop(1,'#e7e4cd');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
    rect(0,0,180,180,['#4f743c','#597c3d','#92948c'][theme],-.02);
    if(theme===0){
      for(let z=-30;z<40;z+=6)rect(0,z,46,3,'#567f41',0);
      const chalk='#e8ead3';
      line([[-12,.04,-14],[12,.04,-14],[12,.04,26],[-12,.04,26]],chalk,.075,true);
      line([[-12,.04,7],[12,.04,7]],chalk,.085);ring(0,7,4,chalk,.085);
      const x=challenge.goalX;
      line([[x-6.2,.04,-14],[x-6.2,.04,-6],[x+6.2,.04,-6],[x+6.2,.04,-14]],chalk,.075);
      line([[x-4.5,.04,-14],[x-4.5,.04,-10.4],[x+4.5,.04,-10.4],[x+4.5,.04,-14]],chalk,.075);
      ring(x,-6,3.2,chalk,.07,.04,0,Math.PI);ring(x,-8.5,.045,chalk,.07,.04);
    }else if(theme===2){
      rect(0,-3,18,70,'#747b7a',0);
      for(const side of[-1,1]){
        rect(side*10.2,-3,2.4,70,'#b7b7a7',.04);line([[side*9,.07,-35],[side*9,.07,30]],'#d2d1bd',.1);
        for(let z=-30;z<30;z+=2.2){block(side*9.1,.02,z,.23,.15,2.12,'#bbb9a6');line([[side*9.4,.06,z],[side*11.4,.06,z]],'#969b91',.023);}
      }
      for(let z=-28;z<22;z+=5)rect(0,z,.13,2.2,'#d9d5ba',.035);
      for(let x=-7.5;x<=7.5;x+=1.5)rect(x,-15,.75,2.5,'#d9d8c5',.04);
      for(const x of[-7.5,7.5]){rect(x,-7,.6,1.5,'#5a625e',.04);for(let i=0;i<5;i++)line([[x-.24,.05,-7.6+i*.27],[x+.24,.05,-7.6+i*.27]],'#414a45',.025);}
      for(let i=0;i<180;i++){const x=(noise(i+40)-.5)*17,z=-28+noise(i+620)*56;rect(x,z,.02+noise(i+34)*.07,.02+noise(i+89)*.11,i%3?'#818583':'#686f6d',.041);}
    }else{
      for(let i=0;i<100;i++){const x=(noise(i+3)-.5)*34,z=-28+noise(i+88)*55,r=.15+noise(i+298)*.5;rect(x,z,r,r*1.6,i%3?'#618545':'#507037',.003);}
      for(let i=0;i<200;i++){
        const x=(noise(i+500)-.5)*28,z=-25+noise(i+200)*49;if(Math.abs(x)<2.2&&z>6)continue;const h=.08+noise(i+9)*.12;
        line([[x-.05,.02,z],[x-.1,h,z-.02],[x-.025,h*.3,z],[x,h*1.3,z+.015],[x+.03,.02,z]],i%2?'#3c612b':'#8b9a57',.012);
      }
    }
    // Fine turf blades are rendered once into the cached backdrop.
    if(theme!==2){
      ctx.save();ctx.globalAlpha=.22;
      for(let i=0;i<1600;i++){
        const x=(noise(i+430)-.5)*28,z=-25+noise(i+1900)*55;
        const a=project([x,.028,z]),b=project([x+.015,.055+noise(i+65)*.035,z-.025]);
        if(!a.visible||a.y<height*.08)continue;
        ctx.strokeStyle=i%3?'#c2c68b':'#1f4d2a';ctx.lineWidth=Math.max(.45,unitAt(x,.03,z)*.009);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
      }
      ctx.restore();
    }
  }
  function stadium(){
    // Concrete terraces, individual seats and a varied crowd give a real scale.
    block(0,0,-26.3,49,6.4,2.1,'#66757b','#53616a','#8b9696');
    for(let row=6;row>=0;row--){
      const z=-17.1-row*1.18,h=.65+row*.55;block(0,0,z,46,h,1.1,'#9b9f94','#717e7b','#a1a49b');
      for(let i=0;i<43;i++){
        const x=-23+i*1.08+(row%2)*.25,seat=(i+row)%7?'#355a6b':'#b9aa74';
        block(x,h,z,.67,.11,.58,seat,shade(seat,.76));block(x,h+.1,z-.25,.69,.47,.08,shade(seat,1.05));
        if((i*7+row*3)%6===0)continue;
        const shirt=['#b1c8bf','#376578','#ddd6bc','#ad6046','#486957','#d0ac6a'][(i*3+row*7)%6];
        const skin=['#bd8665','#d9b28c','#8f6047','#edc5a0'][(i+row*3)%4];
        const head=project([x,h+.96,z+.05]),u=unitAt(x,h+.9,z);
        line([[x-.10,h+.18,z+.18],[x-.10,h+.48,z+.2],[x-.17,h+.59,z]],'#334547',.095);
        line([[x+.10,h+.18,z+.18],[x+.10,h+.48,z+.2],[x+.17,h+.59,z]],'#334547',.095);
        line([[x,h+.47,z],[x,h+.80,z]],shirt,.29);line([[x-.16,h+.74,z],[x-.23,h+.5,z+.17]],shirt,.105);line([[x+.16,h+.74,z],[x+.23,h+.5,z+.17]],shirt,.105);
        ellipse(head.x,head.y,u*.105,u*.14,skin);ellipse(head.x,head.y-u*.09,u*.11,u*.07,'#42413a');
      }
    }
    // Thin roof and supports sit behind the crowd rather than blocking play.
    for(const x of[-23,-15,-7,7,15,23])line([[x,3.6,-25.8],[x,8.0,-25.8]],'#52646e',.18);
    block(0,7.9,-25.3,50,.16,4.4,'#adb9b8','#6e8188','#c5ccbd');
    for(let i=-6;i<=6;i++)line([[i*4,7.7,-23.1],[i*4,7.7,-27.5]],'#5d737b',.08);
    block(0,0,-15.15,46,.79,.28,'#142f3d','#152e3c','#536c70');
    for(let i=-10;i<=10;i++){const x=i*2.1;polygon([[x-.91,.12,-14.99],[x+.91,.12,-14.99],[x+.91,.65,-14.99],[x-.91,.65,-14.99]],i%4?'#214b59':'#c7ad60');}
    const title=project([challenge.goalX,.49,-14.8]);ctx.fillStyle='#eff0d7';ctx.textAlign='center';ctx.font=`800 ${Math.max(8,unitAt(0,.5,-15)*.33)}px Arial`;ctx.fillText('G O L I N G O   F C',title.x,title.y);
    for(const side of[-1,1]){
      line([[side*18,0,-17],[side*18,10,-17]],'#52676d',.16);block(side*18,9.6,-17,2.6,.64,.32,'#314a57','#293e48','#617d84');
      for(let j=0;j<4;j++)block(side*18+(j-1.5)*.56,9.7,-16.8,.42,.36,.04,'#e9ead5','#e9ead5');
    }
  }
  function building(x,z,w,h,d,tint,index){
    groundShadow(x-1,z+1,w*.7,d*.7,.12);block(x,0,z,w,h,d,tint);block(x,h,z,w+.18,.16,d+.18,shade(tint,1.18));
    const front=z+d/2+.02,cols=Math.max(2,Math.floor(w/1.25)),rows=Math.max(2,Math.floor(h/1.8));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const px=x-w/2+(c+.5)*w/cols,py=1.05+r*1.55,ww=w/cols*.57,wh=1.05;
      polygon([[px-ww/2,py,front],[px+ww/2,py,front],[px+ww/2,py+wh,front],[px-ww/2,py+wh,front]],'#e7d7b6');
      polygon([[px-ww*.37,py+.07,front+.01],[px+ww*.37,py+.07,front+.01],[px+ww*.37,py+wh-.09,front+.01],[px-ww*.37,py+wh-.09,front+.01]],(c+r+index)%4?'#52666a':'#9eb7b2');
      polygon([[px-ww*.34,py+wh-.13,front+.014],[px+ww*.30,py+wh-.13,front+.014],[px-ww*.15,py+.19,front+.014],[px-ww*.34,py+.19,front+.014]],(c+r+index)%3?'#748b8c':'#9aada6');line([[px,py+.08,front+.02],[px,py+wh-.10,front+.02]],'#c0c4b5',.026);line([[px-ww*.36,py+wh*.49,front+.02],[px+ww*.36,py+wh*.49,front+.02]],'#c0c4b5',.026);
    }
    const dx=x+((index%3)-1)*w*.17;polygon([[dx-.45,0,front+.03],[dx+.45,0,front+.03],[dx+.45,1.4,front+.03],[dx-.45,1.4,front+.03]],'#474f4b');
    if(index%2===0){block(x,.1,front+.22,w*.72,.12,.64,'#b6a483');for(let i=0;i<4;i++){const p=project([x-w*.26+i*w*.17,.48,front+.22]),u=unitAt(x,.48,front);ellipse(p.x,p.y,u*.28,u*.24,i%2?'#a9b84c':'#8b9c3c');}}
  }
  function city(){
    const colors=['#c47a52','#67a1ac','#aa8d68','#dfad77','#7ba7ba','#b5826e'];
    for(let i=0;i<8;i++)building(-18+i*5,-20.8,4.7,7+(i%3)*1.4,4,colors[i%colors.length],i);
    for(const side of[-1,1])for(let i=3;i>=0;i--)building(side*(13.4+(i%2)*.4),-10-i*7,5,5.2+(i%3)*2,5.8,colors[(i+(side>0?2:0))%colors.length],i+10);
    for(const x of[-9,9]){line([[x,0,-12],[x,5.5,-12]],'#66716a',.1);line([[x,5.5,-12],[x+(x<0?.7:-.7),5.5,-12]],'#67716a',.13);const p=project([x+(x<0?.7:-.7),5.45,-12]);ellipse(p.x,p.y,unitAt(x,5,-12)*.2,unitAt(x,5,-12)*.07,'#f4e7b7');}
  }
  function tree(x,z,h,pine=false){
    groundShadow(x-.7,z-.5,h*.36,h*.31,.20);line([[x,0,z],[x+.05,h*.72,z]],'#675340',.20);line([[x-.025,0,z+.02],[x+.025,h*.6,z+.02]],'#92806a',.045);
    if(pine){
      for(let layer=0;layer<5;layer++){
        const y=h*.20+layer*h*.14,r=h*(.29-layer*.043),top=project([x,y+h*.39,z]),bottom=project([x,y,z]),u=unitAt(x,y,z);
        ctx.beginPath();ctx.moveTo(top.x,top.y);
        for(let k=0;k<=8;k++){const a=Math.PI*k/8,edge=Math.cos(a)*r*u,rag=(k%2?.94:1.08);ctx.lineTo(bottom.x+edge*rag,bottom.y+Math.sin(a)*r*u*.26+(k%2?u*.05:0));}
        ctx.closePath();ctx.fillStyle=layer%2?'#3b6244':'#2d553c';ctx.fill();
        ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(bottom.x-r*u,bottom.y);ctx.quadraticCurveTo(bottom.x-r*u*.35,bottom.y+r*u*.18,bottom.x,bottom.y+r*u*.14);ctx.closePath();ctx.fillStyle='rgba(14,39,31,.2)';ctx.fill();
      }
    }else{
      for(let j=0;j<3;j++)line([[x,h*.36,z],[x+(j-1)*h*.19,h*(.63+j*.045),z+.1]],'#695b43',.10);
      const clusters=[[-.19,.67,.04,.23],[.15,.70,.02,.25],[0,.88,0,.25],[-.04,.59,.12,.27],[.25,.59,.08,.18],[-.28,.52,.03,.18]];
      for(let i=0;i<clusters.length;i++){
        const [ox,oy,oz,size]=clusters[i],p=project([x+ox*h,oy*h,z+oz*h]),u=unitAt(x,oy*h,z),r=h*size*u,g=ctx.createRadialGradient(p.x-r*.33,p.y-r*.42,r*.08,p.x+r*.12,p.y+r*.14,r*1.22);
        g.addColorStop(0,i%2?'#83955a':'#728c50');g.addColorStop(.65,'#527741');g.addColorStop(1,'#335c36');ellipse(p.x,p.y,r,r*(.83+i%3*.1),g);
        ctx.save();ctx.globalAlpha=.21;for(let j=0;j<7;j++){const a=noise(i*40+j)*Math.PI*2,rr=r*(.4+noise(j+50)*.48);ellipse(p.x+Math.cos(a)*rr,p.y+Math.sin(a)*rr*.77,r*.19,r*.16,j%2?'#abc282':'#2f5435');}ctx.restore();
      }
    }
  }
  function forest(){
    const items=[];for(let i=0;i<15;i++)items.push({x:-18+i*2.6,z:-19-(i%3)*2,h:4.3+(i%4)*.5,p:i%2===0});
    for(const side of[-1,1])for(let i=0;i<8;i++)items.push({x:side*(7.3+(i%3)*1.4),z:-12+i*3.6,h:3.6+(i%4)*.6,p:i%3!==0});
    items.sort((a,b)=>a.z-b.z);for(const item of items)tree(item.x,item.z,item.h,item.p);
    for(const [x,z]of[[-7,-9],[7.2,1],[-8,5],[9,-16]]){groundShadow(x,z,.8,.5,.18);polygon([[x-.7,.04,z+.3],[x-.45,.52,z],[x+.25,.66,z-.13],[x+.7,.25,z+.2],[x+.52,.02,z+.47]],'#818b7d');polygon([[x-.45,.52,z],[x-.18,.63,z-.36],[x+.25,.66,z-.13],[x+.7,.25,z+.2]],'#b1b4a1');}
  }
  function paintGoalEffects(){
    const zone=scene.getObjectByName('goalTargetZone');
    if(zone?.visible){
      const w=(zone.geometry?.parameters?.width||8.9)*zone.scale.x,h=zone.geometry?.parameters?.height||2.95,x=zone.position.x,z=zone.position.z||-11.82;
      ctx.save();ctx.globalAlpha=zone.material.opacity;polygon([[x-w/2,.06,z],[x+w/2,.06,z],[x+w/2,h,z],[x-w/2,h,z]],`#${zone.material.color?.getHexString?.()||'e9ff70'}`);ctx.restore();
    }
    const dividers=scene.getObjectByName('goalDividers');if(dividers?.visible)for(const d of dividers.children)line([[d.position.x,.05,-11.76],[d.position.x,3,-11.76]],'#ffffff',.035);
    const targets=scene.getObjectByName('goalBonusTargets');
    if(targets?.visible)for(const target of targets.children){
      if(!target.visible||target.name!=='goalBonusTarget')continue;
      const r=target.geometry?.parameters?.outerRadius||.42,points=[];
      for(let i=0;i<=40;i++){const a=i*Math.PI/20;points.push([target.position.x+Math.cos(a)*r*target.scale.x,target.position.y+Math.sin(a)*r*target.scale.y,target.position.z]);}
      ctx.save();ctx.globalAlpha=target.material?.opacity??.95;ctx.shadowColor='#f1c76a';ctx.shadowBlur=3;line(points,`#${target.material?.color?.getHexString?.()||'f6cd73'}`,.045);ctx.restore();
    }
  }
  function paintGoal(){
    const age=netImpact?clock-netImpact.time:99;
    const x=challenge.goalX,half=challenge.goalWidth/2,left=x-half,right=x+half,front=-11.8,back=front-1.55*(goal.scale.z||1),net='#dae1d5';
    // The impact bends the nearby mesh; the frame and edge attachments stay fixed.
    const netPoint=(px,py,pz)=>{
      if(age<0||age>=1.25||!netImpact)return[px,py,pz];
      const distance=Math.hypot(px-netImpact.x,py-netImpact.y),edge=clamp(Math.min((px-left)/.65,(right-px)/.65,py/.45,(3.05-py)/.45),0,1);
      const wave=Math.sin(age*17-distance*1.6)*Math.exp(-age*3.4-distance*.85)*.34*edge*clamp((front-pz)/(front-back),0,1);
      return[px,py,pz-wave];
    };
    const netWire=(a,b)=>{
      for(let i=0;i<=4;i++){const t=i/4,p=netPoint(mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)),q=project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);}
    };
    groundShadow(x-.2,-12.1,half+.2,1,.15);ctx.save();ctx.globalAlpha=.75;ctx.strokeStyle=net;ctx.lineWidth=Math.max(.5,unitAt(x,1.5,back)*.023);ctx.lineCap='round';ctx.beginPath();
    for(let k=-3;k<=challenge.goalWidth+3;k+=.42){
      const a=Math.max(0,k-3),b=Math.min(challenge.goalWidth,k);if(b>a){netWire([left+a,k-a,back],[left+b,k-b,back]);netWire([right-a,k-a,back],[right-b,k-b,back]);}
    }
    for(let px=left;px<=right+.01;px+=.42)netWire([px,3.05,front],[px,2.9,back]);
    for(let z=front;z>=back;z-=.35)netWire([left,3.05+(z-front)*.1,z],[right,3.05+(z-front)*.1,z]);
    for(const px of[left,right])for(let y=.04;y<3;y+=.4)netWire([px,y,front],[px,y,back]);
    ctx.stroke();ctx.restore();for(const px of[left,right])line([[px,.05,back],[px,2.9,back],[px,3.05,front],[px,.05,front]],'#fbffe8',.15);
    line([[left,3.05,front],[right,3.05,front]],'#ffffff',.19);line([[left,2.9,back],[right,2.9,back]],'#f5f8d9',.12);
  }
  function human(group,isPlayer,index=0){
    const pos=group.position,s=isPlayer?1.18:1,keeper=!!group.userData.keeper;
    const skin=['#c99672','#d2a07d','#926849','#b88160','#e0b38f'][index%5],kit=isPlayer?'#1e8caa':keeper?'#546c3e':'#ac433a',shorts=isPlayer?'#182f40':keeper?'#34412c':'#293f4a',socks=isPlayer?'#dddcc9':keeper?'#416d58':'#c2c4b5',boots=isPlayer?'#213640':keeper?'#292f2c':'#313835';
    const moving=!isPlayer&&group.userData.moving,step=moving?Math.sin(clock*(keeper?9.2:7.5)+index):0,walk=step*(keeper?.045:.10),breath=kickPose<0?Math.sin(clock*2.6+index)*.009:0;
    const anticipating=isPlayer&&kickPose<0&&cheerPose<0,load=anticipating&&charge!==null?charge:0;
    const aimYaw=anticipating?clamp(Math.atan2(aim.x-challenge.startX+aim.bend*.20,challenge.startZ+11.8),-.16,.16):0;
    const torsoYaw=aimYaw*.28,loadCrouch=load*.025;
    const saveAge=keeper&&Number.isFinite(group.userData.saveAt)?clock-group.userData.saveAt:99;
    const saveAmount=saveAge>=0&&saveAge<1.2?smooth(saveAge/.26)*(1-smooth((saveAge-.52)/.68)):0,saveSide=group.userData.saveSide||1;
    let bodyLean=isPlayer&&kickPose>=0?-.14*Math.sin(Math.min(1,kickPose/.8)*Math.PI):anticipating?-.045*load:0;
    const gap=ball.position.z-pos.z,keeperReach=keeper&&ball.visible&&gap<4&&gap>-.5?clamp((ball.position.y-1.5)/1.1,0,1)*clamp((4-gap)/1.8,0,1):0;
    const tracking=keeper&&gap<8&&gap>-.8?clamp((ball.position.x-pos.x)*.045,-.065,.065):0;
    const crouch=keeper?.12*(1-keeperReach):loadCrouch,keeperJump=keeperReach*.5,roll=-saveSide*saveAmount*.82+tracking*(1-saveAmount);
    const p=(dx,dy,dz=0)=>{
      const upper=smooth((dy-.95)/.65),yaw=torsoYaw*upper,xx=dx*Math.cos(yaw)+dz*Math.sin(yaw),zz=dz*Math.cos(yaw)-dx*Math.sin(yaw);
      // Breathing and charge live above the ankles so the planted soles do not float.
      const yy=dy-crouch*smooth((dy-.14)/.48)+breath*smooth((dy-.2)/.8),rx=xx*Math.cos(roll)-(yy-.75)*Math.sin(roll),ry=.75+xx*Math.sin(roll)+(yy-.75)*Math.cos(roll);
      return [pos.x+(rx+saveSide*saveAmount*.24)*s,pos.y+(ry+saveAmount*.12+keeperJump)*s,pos.z+(zz+bodyLean*Math.max(0,dy-.9))*s];
    };
    function joint(v,r,fill){const q=project(p(...v)),u=unitAt(...p(...v));ellipse(q.x,q.y,r*u*s,r*u*s,fill);}
    function limb(a,b,fill,wa,wb=wa*.8){
      const aw=p(...a),bw=p(...b),aa=project(aw),bb=project(bw),ua=unitAt(...aw)*s,ub=unitAt(...bw)*s,dx=bb.x-aa.x,dy=bb.y-aa.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      const ra=ua*wa*.5,rb=ub*wb*.5,g=ctx.createLinearGradient(aa.x-nx*ra,aa.y-ny*ra,aa.x+nx*ra,aa.y+ny*ra);
      g.addColorStop(0,shade(fill,.69));g.addColorStop(.36,fill);g.addColorStop(.75,shade(fill,1.08));g.addColorStop(1,shade(fill,.85));
      ctx.beginPath();ctx.moveTo(aa.x+nx*ra,aa.y+ny*ra);ctx.lineTo(bb.x+nx*rb,bb.y+ny*rb);ctx.quadraticCurveTo(bb.x+dx/len*rb,bb.y+dy/len*rb,bb.x-nx*rb,bb.y-ny*rb);ctx.lineTo(aa.x-nx*ra,aa.y-ny*ra);ctx.quadraticCurveTo(aa.x-dx/len*ra,aa.y-dy/len*ra,aa.x+nx*ra,aa.y+ny*ra);ctx.closePath();ctx.fillStyle=g;ctx.fill();
    }
    const lerpV=(a,b,t)=>a.map((v,i)=>mix(v,b[i],smooth(t)));
    let leftKnee=[-.16,.53,walk*.4],leftFoot=[-.18,.075+Math.max(0,step)*.027,-walk],rightKnee=[.16,.53,-walk*.4],rightFoot=[.18,.075+Math.max(0,-step)*.027,walk];
    if(anticipating){leftKnee[2]-=load*.075;rightKnee[2]-=load*.075;}
    if(isPlayer&&kickPose>=0){
      const k=kickPose;
      if(k<.31){rightKnee=lerpV([.17,.54,0],[.19,.70,.22],k/.31);rightFoot=lerpV([.19,.08,0],[.21,.36,.59],k/.31);}
      else if(k<.523){rightKnee=lerpV([.19,.70,.22],[.26,.56,-.10],(k-.31)/.213);rightFoot=lerpV([.21,.36,.59],[.29,.15,-.31],(k-.31)/.213);}
      else if(k<.84){rightKnee=lerpV([.26,.56,-.10],[.24,.79,-.34],(k-.523)/.317);rightFoot=lerpV([.29,.15,-.31],[.33,shotStyle==='chip'?.84:.68,-.61],(k-.523)/.317);}
      else{rightKnee=lerpV([.24,.79,-.34],[.22,.61,-.20],(k-.84)/.16);rightFoot=lerpV([.33,shotStyle==='chip'?.84:.68,-.61],[.26,.20,-.32],(k-.84)/.16);}
      leftKnee=[-.17,.54,-.02];leftFoot=[-.15,.075,-.06];
    }
    if(keeper){leftKnee=[-.29,.49+Math.max(0,step)*.015,-.04];rightKnee=[.29,.49+Math.max(0,-step)*.015,-.04];leftFoot=[-.38,.075+Math.max(0,step)*.02,walk];rightFoot=[.38,.075+Math.max(0,-step)*.02,-walk];}
    groundShadow(pos.x-.27+saveSide*saveAmount*.2,pos.z-.35,.42*s,.67*s,.28);
    const legs=[{side:-1,knee:leftKnee,foot:leftFoot},{side:1,knee:rightKnee,foot:rightFoot}];
    for(const {side,knee,foot} of legs){
      const hip=[side*.145,1.01,.015],hem=lerpV(hip,knee,.34),sockTop=lerpV(knee,foot,.22);
      limb(hip,hem,shorts,.27,.23);limb(hem,knee,skin,.205,.145);joint(knee,.074,skin);limb(knee,sockTop,skin,.145,.135);limb(sockTop,foot,socks,.145,.105);
      const band=lerpV(sockTop,foot,.12);limb(sockTop,band,isPlayer?'#245168':keeper?'#b1b99a':'#8f3938',.151,.145);
      const [fx,fy,fz]=foot,dir=isPlayer?-1:1;
      if(isPlayer&&fy<.10){const footGround=p(fx,0,fz-.06);groundShadow(footGround[0],footGround[2],.115*s,.20*s,.20);}
      polygon([p(fx-.085,fy-.025,fz+.09*dir),p(fx+.085,fy-.025,fz+.09*dir),p(fx+.105,fy-.025,fz+.24*dir),p(fx-.09,fy-.025,fz+.26*dir)],'#c0bc92');
      polygon([p(fx-.083,fy+.055,fz-.06*dir),p(fx+.084,fy+.055,fz-.06*dir),p(fx+.105,fy+.025,fz+.21*dir),p(fx-.085,fy+.025,fz+.25*dir)],boots);
      line([p(fx-.07,fy+.06,fz+.05*dir),p(fx+.07,fy+.06,fz+.09*dir)],'#90b6b9',.022*s);
      for(const t of[.02,.07,.12])line([p(fx-.04,fy+.065,fz+t*dir),p(fx+.04,fy+.065,fz+(t+.02)*dir)],'#d4d7c9',.012*s);
    }
    // Arms are jointed, with a bent elbow and a separate wrist/hand.
    const arms=[];
    for(const side of[-1,1]){
      const shoulder=[side*.255,1.59,.015];let elbow=[side*.34,1.29,.035],hand=[side*.28,1.065,.11];
      if(anticipating){elbow=[side*(.34+.045*load),1.29+.035*load,.035+side*aimYaw*.15];hand=[side*(.28+.07*load),1.065+.065*load,.11+side*aimYaw*.22];}
      if(isPlayer&&kickPose>=0){const wind=Math.sin(Math.min(1,kickPose/.85)*Math.PI);elbow=[side*(.36+.14*wind),1.32+.12*wind,side===-1?-.15*wind:.25*wind];hand=[side*(.41+.16*wind),1.17+.18*wind,side===-1?-.3*wind:.34*wind];}
      if(isPlayer&&cheerPose>=0){elbow=[side*.43,1.86,.03];hand=[side*.36,2.12,-.06];}
      if(keeper){elbow=lerpV([side*.46,1.19,-.05],[side*.30,1.92,-.04],keeperReach);hand=lerpV([side*.59,1.34,-.10],[side*.25,2.22,-.06],keeperReach);if(saveAmount>.05){elbow=[saveSide*.54,1.50+side*.13,-.13];hand=[saveSide*.91,1.61+side*.15,-.2];}}
      arms.push({shoulder,elbow,hand});
      limb(shoulder,elbow,skin,.16,.12);limb(elbow,hand,skin,.12,.083);joint(elbow,.061,skin);
      const cuff=lerpV(shoulder,elbow,.36);limb(shoulder,cuff,kit,.22,.19);
      joint(hand,keeper?.095:.058,keeper?'#e4ddbb':skin);
      if(keeper)limb(lerpV(elbow,hand,.78),hand,'#a5b292',.14,.16);
    }
    // Sculpted shirt silhouette with side panels, collar and fabric seams.
    const torso=[p(-.18,.95,.10),p(.18,.95,.10),p(.22,1.33,.14),p(.285,1.54,.105),p(.18,1.66,.06),p(-.18,1.66,.06),p(-.285,1.54,.105),p(-.22,1.33,.14)];
    const tp=project(p(0,1.25,.14)),tu=unitAt(...p(0,1.25,.14))*s,shirtGrad=ctx.createLinearGradient(tp.x-tu*.3,0,tp.x+tu*.3,0);shirtGrad.addColorStop(0,shade(kit,.68));shirtGrad.addColorStop(.35,kit);shirtGrad.addColorStop(.72,shade(kit,1.12));shirtGrad.addColorStop(1,shade(kit,.78));polygon(torso,shirtGrad);
    polygon([p(-.18,.95,.112),p(-.11,.95,.13),p(-.18,1.5,.15),p(-.26,1.55,.115)],shade(kit,.74));
    polygon([p(.18,.95,.112),p(.12,.95,.13),p(.19,1.49,.15),p(.26,1.55,.115)],shade(kit,.82));
    line([p(-.19,1.56,.12),p(-.09,1.65,.13),p(.09,1.65,.13),p(.19,1.56,.12)],'#c8ded7',.027*s);
    if(isPlayer){for(const side of[-1,1])line([p(side*.115,1.63,.125),p(side*.23,1.57,.13)],'#c9ded6',.018*s);line([p(-.17,1.06,.15),p(-.08,1.08,.16)],shade(kit,.85),.012*s);line([p(.08,1.13,.16),p(.17,1.10,.15)],shade(kit,1.13),.012*s);}
    line([p(-.17,1.02,.14),p(.16,1.02,.14)],shade(kit,.75),.018*s);
    limb([0,1.62,.035],[0,1.77,.035],skin,.135,.13);
    // A human head: smaller cranium, tapered jaw, ears and a dark hairline.
    const headWorld=p(aimYaw*.15,1.88,.022),head=project(headWorld),u=unitAt(...headWorld)*s,rx=.142*u,ry=.178*u;
    const faceGrad=ctx.createLinearGradient(head.x-rx,head.y,head.x+rx,head.y);faceGrad.addColorStop(0,shade(skin,.69));faceGrad.addColorStop(.38,skin);faceGrad.addColorStop(.74,shade(skin,1.12));faceGrad.addColorStop(1,shade(skin,.82));
    for(const side of[-1,1])ellipse(head.x+side*rx*(.96+side*aimYaw*.20),head.y+ry*.05,rx*.20,ry*.26,skin);
    ctx.beginPath();ctx.moveTo(head.x,head.y-ry);ctx.bezierCurveTo(head.x+rx,head.y-ry*1.05,head.x+rx*1.07,head.y,head.x+rx*.72,head.y+ry*.67);ctx.quadraticCurveTo(head.x+rx*.45,head.y+ry*.98,head.x,head.y+ry*1.03);ctx.quadraticCurveTo(head.x-rx*.45,head.y+ry*.98,head.x-rx*.72,head.y+ry*.67);ctx.bezierCurveTo(head.x-rx*1.07,head.y,head.x-rx,head.y-ry*1.05,head.x,head.y-ry);ctx.closePath();ctx.fillStyle=faceGrad;ctx.fill();
    const hair=index%4===2?'#40362c':'#302e28';
    ctx.beginPath();ctx.moveTo(head.x-rx*.94,head.y+ry*(isPlayer?.5:-.12));ctx.bezierCurveTo(head.x-rx*1.12,head.y-ry*.8,head.x-rx*.42,head.y-ry*1.17,head.x+rx*.3,head.y-ry*1.08);ctx.bezierCurveTo(head.x+rx*1.15,head.y-ry*.87,head.x+rx,head.y-ry*.12,head.x+rx*.86,head.y+ry*(isPlayer?.55:-.07));
    if(isPlayer)ctx.quadraticCurveTo(head.x+aimYaw*rx,head.y+ry*.75,head.x-rx*.94,head.y+ry*.5);else{ctx.lineTo(head.x+rx*.66,head.y-ry*.49);ctx.quadraticCurveTo(head.x-rx*.2,head.y-ry*.28,head.x-rx*.78,head.y-ry*.42);}
    ctx.closePath();ctx.fillStyle=hair;ctx.fill();
    ctx.strokeStyle='#5b5040';ctx.lineWidth=Math.max(.4,u*.012);for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(head.x-rx*.6+i*rx*.28,head.y-ry*.78);ctx.quadraticCurveTo(head.x-rx*.53+i*rx*.28,head.y-ry*.94,head.x-rx*.3+i*rx*.26,head.y-ry*.96);ctx.stroke();}
    if(!isPlayer){
      for(const side of[-1,1]){ctx.strokeStyle='#514338';ctx.lineWidth=Math.max(.5,u*.013);ctx.beginPath();ctx.moveTo(head.x+side*rx*.22,head.y-ry*.08);ctx.lineTo(head.x+side*rx*.57,head.y-ry*.11);ctx.stroke();ellipse(head.x+side*rx*.39,head.y+ry*.015,u*.012,u*.015,'#292e28');}
      ctx.strokeStyle=shade(skin,.73);ctx.lineWidth=Math.max(.5,u*.011);ctx.beginPath();ctx.moveTo(head.x+u*.006,head.y+ry*.13);ctx.lineTo(head.x+u*.014,head.y+ry*.36);ctx.lineTo(head.x-u*.013,head.y+ry*.38);ctx.stroke();ctx.strokeStyle='#805748';ctx.beginPath();ctx.moveTo(head.x-rx*.25,head.y+ry*.63);ctx.quadraticCurveTo(head.x,head.y+ry*.68,head.x+rx*.25,head.y+ry*.61);ctx.stroke();
    }
    const number=project(p(0,1.32,.17)),nu=unitAt(...p(0,1.32,.17))*s;ctx.fillStyle=isPlayer?'#e9e8cd':'#e6d6bc';ctx.textAlign='center';
    if(isPlayer){ctx.font=`700 ${Math.max(5,nu*.072)}px Arial`;ctx.fillText('GOLINGO',number.x,number.y-nu*.15);ctx.font=`800 ${Math.max(9,nu*.27)}px Arial`;ctx.fillText('10',number.x,number.y+nu*.105);}
    else{ctx.font=`800 ${Math.max(4,nu*.12)}px Arial`;ctx.fillText(keeper?'1':String(3+index),number.x,number.y+nu*.07);}
  }
  function paintBall(){
    if(!ball.visible)return;const altitude=Math.max(0,ball.position.y-.28);groundShadow(ball.position.x+.10+altitude*.30,ball.position.z-.10-altitude*.15,.34+altitude*.10,.29+altitude*.08,Math.max(.075,.27-altitude*.045));
    if(altitude<.55)groundShadow(ball.position.x,ball.position.z,.18,.15,.20*(1-altitude/.55));
    const s=project(ball.position),r=unitAt(ball.position.x,ball.position.y,ball.position.z)*.27*.9,g=ctx.createRadialGradient(s.x-r*.35,s.y-r*.45,r*.04,s.x+r*.15,s.y+r*.15,r*1.15);g.addColorStop(0,'#ffffff');g.addColorStop(.65,'#f6f7ef');g.addColorStop(1,'#b8c4ae');ellipse(s.x,s.y,r,r,g);
    ctx.save();ctx.beginPath();ctx.arc(s.x,s.y,r*.98,0,Math.PI*2);ctx.clip();ctx.translate(s.x,s.y);ctx.rotate(ball.rotation.x*.45+ball.rotation.z*.25);
    function pent(cx,cy,size){ctx.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;i?ctx.lineTo(cx+Math.cos(a)*size,cy+Math.sin(a)*size):ctx.moveTo(cx+Math.cos(a)*size,cy+Math.sin(a)*size);}ctx.closePath();ctx.fillStyle='#17231b';ctx.fill();}
    pent(0,0,r*.43);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;pent(Math.cos(a)*r*.99,Math.sin(a)*r*.99,r*.38);ctx.strokeStyle='#a8b2a7';ctx.lineWidth=Math.max(.45,r*.025);ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.4,Math.sin(a)*r*.4);ctx.lineTo(Math.cos(a+.12)*r*.8,Math.sin(a+.12)*r*.8);ctx.stroke();}ctx.restore();
    // A soft edge shade wraps across the panels, making the rotating ball spherical.
    const edge=ctx.createRadialGradient(s.x-r*.35,s.y-r*.45,r*.18,s.x+r*.2,s.y+r*.23,r*1.2);edge.addColorStop(0,'rgba(255,255,255,.16)');edge.addColorStop(.60,'rgba(255,255,255,0)');edge.addColorStop(1,'rgba(27,46,40,.23)');ellipse(s.x,s.y,r,r,edge);
  }
  function obstacle(o){
    const x=o.group.position.x,z=o.group.position.z,w=o.width,d=o.depth,h=o.height;groundShadow(x+.22,z-.25,w*.60,d*.65,.25);
    if(o.type==='cone'){
      block(x,0,z,w,.10,d,'#3d4640','#303a36');const base=project([x,.1,z]),top=project([x,h,z]),r=unitAt(x,.1,z)*w*.38;
      const coneGrad=ctx.createLinearGradient(base.x-r,0,base.x+r,0);coneGrad.addColorStop(0,'#c26a29');coneGrad.addColorStop(.42,'#e8953a');coneGrad.addColorStop(.72,'#efad50');coneGrad.addColorStop(1,'#bf6b2d');
      ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(base.x+r,base.y);ctx.quadraticCurveTo(base.x,base.y+r*.36,base.x-r,base.y);ctx.closePath();ctx.fillStyle=coneGrad;ctx.fill();
      for(const y of[.40,.70]){const a=project([x,h*y,z]),b=project([x,h*(y+.13),z]),ra=r*(1-y),rb=r*(1-y-.13);ctx.beginPath();ctx.moveTo(a.x-ra,a.y);ctx.lineTo(a.x+ra,a.y);ctx.lineTo(b.x+rb,b.y);ctx.lineTo(b.x-rb,b.y);ctx.closePath();ctx.fillStyle='#dedfcb';ctx.fill();}
    }else if(o.type==='log'){
      const count=Math.max(1,Math.ceil(w/.76)),radius=Math.min(.38,w/(count*2),h*.5),topRadius=Math.min(radius,h*.35);
      const logs=[];for(let i=0;i<count;i++)logs.push({px:x-w/2+radius+i*(w-2*radius)/Math.max(1,count-1),yy:radius,rr:radius});
      if(h>radius*2+.05){const upper=Math.max(1,count-1);for(let i=0;i<upper;i++)logs.push({px:x+(i-(upper-1)/2)*(w/(upper+1)),yy:h-topRadius,rr:topRadius});}
      for(let i=0;i<logs.length;i++){
        const {px,yy,rr}=logs[i],back=z-d/2,front=z+d/2;line([[px,yy,back],[px,yy,front]],i%2?'#66513c':'#786046',rr*2);line([[px-rr*.28,yy+rr*.5,back],[px-rr*.28,yy+rr*.5,front]],'#9a7a51',rr*.24);
        for(let j=0;j<3;j++)line([[px+rr*(j-1)*.39,yy+rr*.25,back+.04],[px+rr*(j-1)*.42,yy+rr*.24,front-.03]],j%2?'#51432f':'#8a6a45',.022);
        const q=project([px,yy,front]),u=unitAt(px,yy,front);ellipse(q.x,q.y,rr*u,rr*u*.72,'#b2986d','#66553d',Math.max(.55,u*.025));ellipse(q.x,q.y,rr*u*.69,rr*u*.49,'#b79c72','#806b48',Math.max(.45,u*.015));ellipse(q.x,q.y,rr*u*.36,rr*u*.25,'#aa8c5d','#836d49',Math.max(.4,u*.012));
        ctx.strokeStyle='#7d6543';ctx.lineWidth=Math.max(.45,u*.018);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(q.x+rr*u*.73,q.y-rr*u*.18);ctx.stroke();
      }
    }else{
      block(x,0,z,w,.13,d,'#5c6762','#44514c','#818d81');block(x,.13,z,w,Math.max(.01,h-.13),d,'#8d9690','#5c6968','#aab0a5');
      const front=z+d/2+.008,low=Math.max(.22,h*.28),high=Math.min(h-.07,low+.32);
      if(high>low){
        const face=[[x-w/2,low,front],[x+w/2,low,front],[x+w/2,high,front],[x-w/2,high,front]];polygon(face,'#d9b862');ctx.save();polygon(face,null);ctx.clip();
        for(let px=x-w/2-.5;px<x+w/2+.5;px+=.57)polygon([[px,low,front+.003],[px+.26,low,front+.003],[px+.55,high,front+.003],[px+.29,high,front+.003]],'#3a4946');
        ctx.restore();
      }
      line([[x-w/2+.06,h-.07,front],[x+w/2-.06,h-.07,front]],'#c5c8b8',.025);
      for(const side of[-1,1]){const q=project([x+side*w*.39,h*.78,front]);const u=unitAt(x,h*.78,z);ellipse(q.x,q.y,u*.035,u*.035,'#3c4947');}
    }
  }
  function paintGroundEffects(){
    const guide=scene.getObjectByName('goalGuide');
    if(guide?.visible){const radius=guide.geometry?.parameters?.radius||.14,base=`#${guide.material.color.getHexString()}`;for(let i=0;i<guide.count;i++){guide.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);const s=project(point),r=Math.max(1.8,unitAt(point.x,point.y,point.z)*radius),g=ctx.createRadialGradient(s.x-r*.3,s.y-r*.35,r*.1,s.x,s.y,r);g.addColorStop(0,shade(base,1.25));g.addColorStop(1,base);ellipse(s.x,s.y,r,r,g);}}
    const target=scene.getObjectByName('goalTargetRing');if(target?.visible)ring(target.position.x,target.position.z,.41,'#f9ff9b',.09,.09);
    const trail=scene.getObjectByName('goalTrail');if(trail?.visible){const a=trail.geometry.attributes.position,n=Math.min(a.count,trail.geometry.drawRange.count),pts=[];for(let i=0;i<n;i++)pts.push([a.getX(i),a.getY(i),a.getZ(i)]);ctx.save();ctx.globalAlpha=trail.material.opacity;line(pts,'#ffd36b',.14);ctx.restore();}
  }
  function paintConfetti(){
    const c=scene.getObjectByName('goalConfetti');if(!c?.visible)return;ctx.save();ctx.globalAlpha=c.material.opacity;
    for(let i=0;i<c.count;i++){c.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);const s=project(point),u=unitAt(point.x,point.y,point.z);c.getColorAt(i,color);ctx.fillStyle=`#${color.getHexString()}`;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(clock*4+i);ctx.fillRect(-u*.065,-u*.13,u*.13,u*.26);ctx.restore();}ctx.restore();
  }
  function setDefenders(configs=[]){
    while(defenders.length>configs.length)scene.remove(defenders.pop().group);
    configs.forEach((c,i)=>{let d=defenders[i];if(!d){d={group:new THREE.Group()};scene.add(d.group);defenders.push(d);}Object.assign(d,{baseX:c.x??0,baseZ:c.z??-4,moving:!!c.moving,amplitude:c.amplitude??1.4,phase:c.phase??i*1.7,speed:c.speed??.75,radius:c.radius??.53,height:c.height??(c.keeper?2.8:2.17),keeper:!!c.keeper,hit:false});d.group.position.set(d.baseX,0,d.baseZ);d.group.userData.moving=d.moving;d.group.userData.keeper=d.keeper;delete d.group.userData.saveAt;});
  }
  function setChallenge(config={}){
    for(const name of['startX','startZ','goalX','goalWidth'])if(Number.isFinite(config[name]))challenge[name]=config[name];
    challenge.goalWidth=Math.max(2,challenge.goalWidth);goal.position.set(challenge.goalX,0,-11.8);goal.scale.set(challenge.goalWidth/7,1,1);
    const configs=Array.isArray(config.obstacles)?config.obstacles:[];while(obstacles.length>configs.length)scene.remove(obstacles.pop().group);
    configs.forEach((c,i)=>{let o=obstacles[i];if(!o){o={group:new THREE.Group()};obstacles.push(o);scene.add(o.group);}Object.assign(o,{type:['wall','log','cone'].includes(c.type)?c.type:'wall',baseX:c.x??0,baseZ:c.z??-1,width:Math.max(.1,c.width??2),depth:Math.max(.1,c.depth??.6),height:Math.max(.1,c.height??1.7),moving:!!c.moving,amplitude:c.amplitude??1.4,speed:c.speed??.75,phase:c.phase??i*1.4,hit:false});o.group.position.set(o.baseX,0,o.baseZ);});
    ball.position.set(challenge.startX,.29,challenge.startZ);netImpact=null;resetPlayer();configureCamera(camera,width,height,challenge);sceneryDirty=true;
  }
  function cacheScenery(){
    backdrop.width=canvas.width;backdrop.height=canvas.height;ctx=backdropCtx;ctx.setTransform(density,0,0,density,0,0);paintPitch();
    if(theme===0)stadium();else if(theme===2)city();else forest();ctx=mainCtx;sceneryDirty=false;
  }
  function draw(){
    if(sceneryDirty)cacheScenery();ctx=mainCtx;ctx.setTransform(density,0,0,density,0,0);ctx.drawImage(backdrop,0,0,width,height);paintGoal();paintGoalEffects();paintGroundEffects();actors.length=0;
    for(let i=0;i<defenders.length;i++)actors.push({z:defenders[i].group.position.z,group:defenders[i].group,index:i+1,type:0});for(const object of obstacles)actors.push({z:object.group.position.z+object.depth*.25,object,type:3});
    actors.push({z:player.position.z,group:player,index:0,type:1});if(ball.visible)actors.push({z:ball.position.z,type:2});actors.sort((a,b)=>a.z-b.z);
    for(const actor of actors){if(actor.type===2)paintBall();else if(actor.type===3)obstacle(actor.object);else human(actor.group,actor.type===1,actor.index);}paintConfetti();
  }
  function update(dt,time,state={}){
    clock=time;if(!state.paused){for(const d of defenders)if(d.moving&&!d.hit)d.group.position.x=d.baseX+Math.sin(time*d.speed+d.phase)*d.amplitude;for(const o of obstacles)if(o.moving&&!o.hit)o.group.position.x=o.baseX+Math.sin(time*o.speed+o.phase)*o.amplitude;}draw();
  }
  function kick(p){charge=null;kickPose=clamp(p,0,1);cheerPose=-1;const plant=smooth(kickPose/.32);player.position.x=challenge.startX-.65+.30*plant;player.position.z=challenge.startZ+1-.43*plant;player.position.y=0;}
  function celebrate(p){charge=null;cheerPose=THREE.MathUtils.clamp(p,0,1);kickPose=-1;player.position.y=Math.max(0,Math.sin(cheerPose*Math.PI*3))*.23;}
  function resetPlayer(){charge=null;kickPose=-1;cheerPose=-1;player.position.set(challenge.startX-.65,0,challenge.startZ+1);}
  function setAim({x=challenge.goalX,bend=0,power=.72,style=shotStyle}={}){aim.x=Number.isFinite(x)?x:challenge.goalX;aim.bend=Number.isFinite(bend)?bend:0;aim.power=clamp(Number.isFinite(power)?power:.72,0,1);if(['drive','curl','chip'].includes(style)){aim.style=style;shotStyle=style;}}
  function setCharge(value=null){charge=Number.isFinite(value)?clamp(value,0,1):null;}
  function setShotStyle(style='curl'){shotStyle=['drive','curl','chip'].includes(style)?style:'curl';}
  function scoreGoal(impact={}){netImpact={x:impact.x??challenge.goalX,y:impact.y??1.2,time:clock};}
  function saveBall(blocker,position){if(!blocker?.group)return;blocker.group.userData.saveAt=clock;blocker.group.userData.saveSide=Math.sign((position?.x??ball.position.x)-blocker.group.position.x)||1;}
  function clearShotEffects(){netImpact=null;for(const d of defenders){delete d.group.userData.saveAt;delete d.group.userData.saveSide;}}
  function setTheme(i=0){const next=((i%3)+3)%3;if(next!==theme){theme=next;sceneryDirty=true;}}
  const renderer={domElement:canvas,render:draw,setSize:resize,getPixelRatio:()=>density,dispose(){},info:{render:{calls:1,triangles:0}}};
  function dispose(){mainCtx.clearRect(0,0,canvas.width,canvas.height);}
  resize(canvas.clientWidth||window.innerWidth,canvas.clientHeight||window.innerHeight);setChallenge(challenge);setDefenders([{x:-2.5,z:-4.8},{x:1.5,z:-1.8}]);
  return{THREE,scene,camera,renderer,ball,player,goal,defenders,obstacles,particles,resize,update,setDefenders,setChallenge,setTheme,setShotStyle,setAim,setCharge,scoreGoal,saveBall,clearShotEffects,kick,celebrate,resetPlayer,dispose,project,graphicsMode:'canvas'};
}
