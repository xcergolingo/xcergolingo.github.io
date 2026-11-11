// A joint-connected, continuous 2.5D tennis athlete for the fixed rear camera.
// The joints are solved every frame: no photographic pose swapping or ghosting.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const V=(x,y)=>({x,y});

const READY={
  hip:1.09,lean:0,turn:0,jump:0,
  lfx:-.44,rfx:.44,lfy:0,rfy:0,
  lhx:.17,lhy:1.31,rhx:.28,rhy:1.32,rx:.56,ry:.91
};
// The time .43-.48 portion is racket/ball contact for all strokes. In between,
// the key values are interpolated with continuous, monotone cubic tangents.
const SHOTS={
  serve:[
    [0,{}],
    [.13,{hip:.95,turn:-.13,lhx:-.26,lhy:1.50,rhx:.70,rhy:1.49,rx:1.00,ry:2.06}],
    [.31,{hip:.88,turn:-.29,lean:-.05,lhx:-.26,lhy:2.60,rhx:.72,rhy:1.56,rx:.72,ry:.99,lfx:-.38,rfx:.40}],
    [.45,{hip:1.15,jump:.16,turn:.11,lean:.10,lhx:-.33,lhy:2.20,rhx:.29,rhy:2.87,rx:.32,ry:3.39,lfx:-.36,rfx:.39}],
    [.67,{hip:1.14,jump:.035,turn:.30,lean:-.12,lhx:-.34,lhy:1.39,rhx:-.34,rhy:1.26,rx:-.72,ry:.92,lfx:-.37,rfx:.27}],
    [.83,{hip:1.12,lean:.02,turn:.06,lhx:-.16,lhy:1.35,rhx:-.03,rhy:1.29,rx:-.16,ry:.81}],
    [1,{}]
  ],
  forehand:[
    [0,{}],
    [.20,{hip:1.00,turn:-.40,lean:.08,lfx:-.46,rfx:.46,lhx:-.21,lhy:1.49,rhx:.83,rhy:1.37,rx:1.22,ry:1.74}],
    [.35,{hip:.98,turn:-.49,lean:.08,lhx:-.21,lhy:1.49,rhx:.90,rhy:1.20,rx:1.28,ry:1.36}],
    [.46,{hip:1.10,turn:.17,lean:-.06,lhx:-.21,lhy:1.44,rhx:.53,rhy:1.49,rx:.92,ry:1.65,lfx:-.35,rfx:.38}],
    [.69,{hip:1.10,turn:.47,lean:-.08,lhx:-.23,lhy:1.38,rhx:-.33,rhy:2.06,rx:-.73,ry:2.34,rfx:.18}],
    [.85,{hip:1.11,turn:.12,lhx:-.03,lhy:1.36,rhx:-.09,rhy:1.71,rx:-.37,ry:1.96}],
    [1,{}]
  ],
  backhand:[
    [0,{}],
    [.20,{hip:1.00,turn:.43,lean:-.08,lhx:-.53,lhy:1.26,rhx:-.65,rhy:1.17,rx:-1.07,ry:1.32}],
    [.35,{hip:1.00,turn:.51,lean:-.10,lhx:-.58,lhy:1.33,rhx:-.72,rhy:1.25,rx:-1.19,ry:1.46}],
    [.47,{hip:1.09,turn:-.11,lean:.04,lhx:-.07,lhy:1.52,rhx:.06,rhy:1.54,rx:.48,ry:1.67,lfx:-.37,rfx:.40}],
    [.68,{hip:1.12,turn:-.39,lean:.08,lhx:.52,lhy:1.79,rhx:.68,rhy:1.87,rx:1.06,ry:2.20,lfx:-.32}],
    [.85,{hip:1.11,turn:-.09,lhx:.18,lhy:1.58,rhx:.38,rhy:1.58,rx:.66,ry:1.96}],
    [1,{}]
  ],
  drop:[
    [0,{}],
    [.20,{hip:.96,lean:.15,turn:-.20,lhx:-.12,lhy:1.32,rhx:.58,rhy:1.20,rx:.94,ry:1.36}],
    [.36,{hip:.91,lean:.18,turn:-.23,lhx:-.14,lhy:1.30,rhx:.62,rhy:1.20,rx:.98,ry:1.44}],
    [.46,{hip:1.00,lean:.22,turn:.02,lhx:-.16,lhy:1.28,rhx:.52,rhy:1.13,rx:.86,ry:1.25}],
    [.70,{hip:1.04,lean:.12,turn:.08,lhx:-.13,lhy:1.33,rhx:.45,rhy:1.46,rx:.79,ry:1.62}],
    [.86,{hip:1.08,lean:.04,lhx:-.07,lhy:1.34,rhx:.34,rhy:1.38,rx:.58,ry:1.52}],
    [1,{}]
  ],
  lob:[
    [0,{}],
    [.20,{hip:.88,turn:-.25,lean:-.08,lhx:-.24,lhy:1.46,rhx:.64,rhy:1.00,rx:.95,ry:.60}],
    [.36,{hip:.89,turn:-.25,lean:-.06,lhx:-.20,lhy:1.48,rhx:.69,rhy:1.09,rx:1.02,ry:.74}],
    [.46,{hip:1.16,turn:.19,lean:.08,lhx:-.25,lhy:1.57,rhx:.53,rhy:1.93,rx:.76,ry:2.40}],
    [.68,{hip:1.18,turn:.34,lean:.05,lhx:-.22,lhy:1.39,rhx:-.03,rhy:2.35,rx:-.22,ry:2.87}],
    [.85,{hip:1.12,turn:.11,lhx:-.17,lhy:1.34,rhx:.10,rhy:1.71,rx:.15,ry:2.13}],
    [1,{}]
  ]
};

function poseAt(shot,progress){
  const frames=SHOTS[shot]||SHOTS.forehand;
  const t=clamp(progress,0,1);
  let i=0;while(i<frames.length-2 && t>frames[i+1][0])i++;
  const [t0,a]=frames[i],[t1,b]=frames[i+1],span=t1-t0,u=(t-t0)/span;
  const h00=2*u*u*u-3*u*u+1,h10=u*u*u-2*u*u+u;
  const h01=-2*u*u*u+3*u*u,h11=u*u*u-u*u;
  const result={};
  for(const key of Object.keys(READY)){
    const value=(frame)=>frame[1][key]??READY[key];
    const start=value(frames[i]),end=value(frames[i+1]);
    function tangent(k){
      if(k<=0||k>=frames.length-1)return 0;
      const da=(value(frames[k])-value(frames[k-1]))/(frames[k][0]-frames[k-1][0]);
      const db=(value(frames[k+1])-value(frames[k]))/(frames[k+1][0]-frames[k][0]);
      return da*db<=0?0:2*da*db/(da+db);
    }
    result[key]=h00*start+h10*span*tangent(i)+h01*end+h11*span*tangent(i+1);
  }
  return result;
}

// Exact two-bone inverse kinematics: the wrist remains attached to the elbow,
// the elbow to the shoulder, and both legs remain attached to the hips.
function elbowFor(start,end,upper,lower,bend){
  const dx=end.x-start.x,dy=end.y-start.y;
  const distance=Math.max(.0001,Math.hypot(dx,dy));
  const reachable=clamp(distance,.012,upper+lower-.002);
  const along=(upper*upper-lower*lower+reachable*reachable)/(2*reachable);
  const height=Math.sqrt(Math.max(0,upper*upper-along*along));
  const ux=dx/distance,uy=dy/distance;
  return V(start.x+ux*along-bend*uy*height,start.y+uy*along+bend*ux*height);
}
function reachableHand(start,target,maxReach){
  const dx=target.x-start.x,dy=target.y-start.y;
  const len=Math.hypot(dx,dy);
  if(len<=maxReach)return target;
  return V(start.x+dx*maxReach/len,start.y+dy*maxReach/len);
}
function projectedKnee(hip,ankle,side){
  // Tennis knees flex forward/back in depth, rather than folding out to
  // either side like a cartoon squat. Solve the two-bone knee in 3D and
  // project it into the fixed rear camera with only a tiny lateral offset.
  const dx=ankle.x-hip.x,dy=ankle.y+.12-hip.y;
  const dist=Math.max(.001,Math.hypot(dx,dy));
  const reach=Math.min(dist,1.128);
  const along=(.59*.59-.54*.54+reach*reach)/(2*reach);
  const fraction=along/reach;
  return V(hip.x+dx*fraction+side*.012,hip.y+dy*fraction);
}

function capsule(c,a,b,diameter,dark,light){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  const nx=-dy/len,ny=dx/len,rad=diameter*.5;
  const grad=c.createLinearGradient(a.x-nx*rad,a.y-ny*rad,a.x+nx*rad,a.y+ny*rad);
  grad.addColorStop(0,dark);grad.addColorStop(.38,light);grad.addColorStop(1,dark);
  c.lineWidth=diameter;c.lineCap='round';c.strokeStyle=grad;
  c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();
  c.strokeStyle='#091b242b';c.lineWidth=.014;c.stroke();
}
function oval(c,x,y,rx,ry,color){
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
}
function gradient(c,x0,y0,x1,y1,stops){
  const g=c.createLinearGradient(x0,y0,x1,y1);
  for(const [t,color] of stops)g.addColorStop(t,color);
  return g;
}
function foot(c,ankle,side){
  c.save();c.translate(ankle.x,ankle.y+.07);c.rotate(side*.08);
  oval(c,0,.045,.18,.082,'#2e514d');
  oval(c,0,.083,.199,.069,'#e7f1ed');
  oval(c,0,.135,.183,.056,'#a8d6cb');
  c.strokeStyle='#b1bfc1';c.lineWidth=.019;
  for(let n=-1;n<=1;n++){c.beginPath();c.moveTo(n*.067,.13);c.lineTo(n*.06,.20);c.stroke();}
  c.restore();
}
function racket(c,hand,head){
  let dx=head.x-hand.x,dy=head.y-hand.y;
  const length=Math.max(.25,Math.hypot(dx,dy));dx/=length;dy/=length;
  const nx=-dy,ny=dx;
  const neck=V(mix(hand.x,head.x,.58),mix(hand.y,head.y,.58));
  capsule(c,hand,neck,.070,'#071d27','#324a4e');
  capsule(c,neck,head,.032,'#34464e','#d1e7e2');
  c.save();c.translate(head.x,head.y);c.rotate(Math.atan2(dy,dx)-Math.PI/2);
  c.scale(.82,1.06);
  c.fillStyle='#1c344832';c.beginPath();c.ellipse(0,0,.245,.355,0,0,Math.PI*2);c.fill();
  c.strokeStyle='#dce4a9';c.lineWidth=.056;c.beginPath();c.ellipse(0,0,.245,.355,0,0,Math.PI*2);c.stroke();
  c.strokeStyle='#314a5b';c.lineWidth=.019;c.stroke();
  c.strokeStyle='#d7eee4a8';c.lineWidth=.012;
  for(let x=-.175;x<=.18;x+=.062){const edge=Math.sqrt(Math.max(0,1-x*x/(.245*.245)))*.355;c.beginPath();c.moveTo(x,-edge);c.lineTo(x,edge);c.stroke();}
  for(let y=-.26;y<=.261;y+=.074){const edge=Math.sqrt(Math.max(0,1-y*y/(.355*.355)))*.245;c.beginPath();c.moveTo(-edge,y);c.lineTo(edge,y);c.stroke();}
  c.restore();
}

function rigBody(c,pose,walk,walkTime){
  const stride=Math.sin(walkTime)*walk;
  const bounce=.018*Math.sin(walkTime*2)*walk;
  const shift=pose.lean*.52+stride*.046;
  const hipY=pose.hip+pose.jump+bounce;
  const hipL=V(shift-.205,hipY),hipR=V(shift+.205,hipY);
  const width=.415*(1-.25*Math.abs(pose.turn));
  const shoulderL=V(shift+pose.lean*.25-width,hipY+.76+pose.turn*.065);
  const shoulderR=V(shift+pose.lean*.25+width,hipY+.76-pose.turn*.065);
  const leftAnkle=V(pose.lfx-stride*.15,pose.lfy+pose.jump+Math.max(0,stride)*.11);
  const rightAnkle=V(pose.rfx+stride*.15,pose.rfy+pose.jump+Math.max(0,-stride)*.11);
  const leftKnee=projectedKnee(hipL,leftAnkle,-1);
  const rightKnee=projectedKnee(hipR,rightAnkle,1);
  const requestedL=V(pose.lhx+shift*.7,pose.lhy+pose.jump+bounce);
  const requestedR=V(pose.rhx+shift*.7,pose.rhy+pose.jump+bounce);
  const handL=reachableHand(shoulderL,requestedL,.96);
  const handR=reachableHand(shoulderR,requestedR,.995);
  const elbowL=elbowFor(shoulderL,handL,.49,.48,-1);
  const elbowR=elbowFor(shoulderR,handR,.51,.50,1);
  const skinDark='#b08062',skinLight='#f0bd9b';
  // Ground contact shadow remains fixed while the body springs up for a serve.
  c.fillStyle='#020a0a63';c.beginPath();c.ellipse(shift,.006,.60+walk*.08,.088,0,0,Math.PI*2);c.fill();
  for(const [hip,knee,ankle,side] of [[hipL,leftKnee,leftAnkle,-1],[hipR,rightKnee,rightAnkle,1]]){
    capsule(c,hip,knee,.305,skinDark,skinLight);
    capsule(c,knee,ankle,.175,skinDark,'#e5b38e');
    const sockTop=V(mix(knee.x,ankle.x,.62),mix(knee.y,ankle.y,.62));
    capsule(c,sockTop,V(ankle.x,ankle.y+.08),.195,'#b9cfc9','#f9fffb');
    foot(c,ankle,side);
  }
  // Tailored two-legged shorts and an unbroken waistband.
  c.fillStyle=gradient(c,shift-.42,0,shift+.42,0,[[0,'#bfcfc9'],[.38,'#fcfffc'],[1,'#93a9a4']]);
  c.beginPath();c.moveTo(shift-.27,hipY+.12);c.lineTo(shift+.27,hipY+.12);
  c.quadraticCurveTo(shift+.34,hipY-.03,shift+.35,hipY-.34);
  c.lineTo(shift+.065,hipY-.34);c.lineTo(shift,hipY-.15);
  c.lineTo(shift-.065,hipY-.34);c.lineTo(shift-.35,hipY-.34);
  c.quadraticCurveTo(shift-.34,hipY-.03,shift-.27,hipY+.12);c.fill();
  c.lineWidth=.015;c.strokeStyle='#7f9b97';c.stroke();
  c.strokeStyle='#effaf2';c.lineWidth=.035;c.beginPath();
  c.moveTo(shift-.34,hipY-.32);c.lineTo(shift-.074,hipY-.32);
  c.moveTo(shift+.074,hipY-.32);c.lineTo(shift+.34,hipY-.32);c.stroke();
  c.strokeStyle='#9bc5bf';c.lineWidth=.04;c.beginPath();c.moveTo(shift-.26,hipY+.09);c.lineTo(shift+.27,hipY+.09);c.stroke();
  // Toss arm passes behind the torso, the racket arm in front of it.
  capsule(c,shoulderL,elbowL,.215,'#155e7f','#3186ab');
  capsule(c,elbowL,handL,.148,skinDark,skinLight);
  // Torso rotates continuously as the athlete loads then unwinds into contact.
  c.fillStyle=gradient(c,shoulderL.x-.06,hipY,shoulderR.x+.06,hipY,
    [[0,'#104c72'],[.25,'#147bb2'],[.64,'#216f9e'],[1,'#0e375e']]);
  c.beginPath();c.moveTo(shoulderL.x,shoulderL.y);
  c.quadraticCurveTo(shift-.49,hipY+.53,shift-.26,hipY+.12);
  c.quadraticCurveTo(shift,hipY+.02,shift+.26,hipY+.12);
  c.quadraticCurveTo(shift+.50,hipY+.53,shoulderR.x,shoulderR.y);
  c.quadraticCurveTo(shift+.035,hipY+.84,shoulderL.x,shoulderL.y);
  c.fill();c.strokeStyle='#082f46';c.lineWidth=.025;c.stroke();
  c.strokeStyle='#8cc8dc36';c.lineWidth=.036;c.beginPath();
  c.moveTo(shoulderL.x+.05,shoulderL.y-.08);c.quadraticCurveTo(shift+.12,hipY+.52,shift+.07,hipY+.13);c.stroke();
  c.strokeStyle='#d9f3f4bd';c.lineWidth=.042;c.beginPath();c.moveTo(shift-.24,hipY+.12);c.lineTo(shift+.24,hipY+.12);c.stroke();
  // A neck that follows torso movement, followed by hair and subtle ears.
  const headX=shift+pose.lean*.18,neckY=hipY+.87;
  capsule(c,V(headX,neckY-.12),V(headX,neckY+.095),.205,skinDark,skinLight);
  oval(c,headX-.194,neckY+.26,.033,.075,'#ba8668');
  oval(c,headX+.194,neckY+.26,.033,.075,'#ba8668');
  c.fillStyle=gradient(c,headX-.22,neckY,headX+.23,neckY,[[0,'#a36f53'],[.37,'#e6ac87'],[1,'#9b664b']]);
  c.beginPath();c.ellipse(headX,neckY+.26,.218,.260,-pose.turn*.09,0,Math.PI*2);c.fill();
  c.fillStyle=gradient(c,headX-.21,neckY+.34,headX+.22,neckY+.48,[[0,'#101d25'],[.5,'#32383d'],[1,'#0d1923']]);
  c.beginPath();c.moveTo(headX-.20,neckY+.23);c.quadraticCurveTo(headX-.24,neckY+.60,headX,neckY+.56);
  c.quadraticCurveTo(headX+.26,neckY+.56,headX+.21,neckY+.23);
  c.quadraticCurveTo(headX+.08,neckY+.36,headX,neckY+.28);
  c.quadraticCurveTo(headX-.09,neckY+.36,headX-.20,neckY+.23);c.fill();
  c.strokeStyle='#a4b9c91b';c.lineWidth=.022;c.beginPath();c.moveTo(headX-.13,neckY+.45);c.quadraticCurveTo(headX+.02,neckY+.48,headX+.13,neckY+.43);c.stroke();
  // Hitting arm and racket stay joined at every instant of every stroke.
  capsule(c,shoulderR,elbowR,.221,'#155777','#2c87ab');
  capsule(c,elbowR,handR,.152,skinDark,skinLight);
  capsule(c,V(mix(elbowR.x,handR.x,.86),mix(elbowR.y,handR.y,.86)),handR,.177,'#e5e8dc','#faf9f1');
  oval(c,handR.x,handR.y,.078,.095,'#e5b18e');
  racket(c,handR,V(pose.rx+shift*.7+handR.x-requestedR.x,pose.ry+pose.jump+bounce+handR.y-requestedR.y));
  oval(c,handL.x,handL.y,.080,.092,'#dfa883');
}

export function drawKinematicPlayer(c,actor,project,view){
  const anchor=project(actor.position.x,actor.position.z);
  const depth=anchor.depth;
  const height=view.h*(.205+.047*depth);
  const scale=height/2.68;
  const rig=actor.userData;
  const progress=rig.hitTime>0?clamp(1-rig.hitTime/(rig.hitDuration||1),0,1):0;
  const pose=rig.hitTime>0?poseAt(rig.hitType,progress):{...READY};
  c.save();
  c.translate(anchor.x,anchor.y);
  c.scale(scale,-scale);
  rigBody(c,pose,rig.walkStrength||0,rig.walkTime||0);
  c.restore();
}

export function drawBallMachine(c,machine,project,view,elapsed){
  const p=project(machine.position.x,machine.position.z);
  const scale=view.h*(.026+.010*p.depth);
  const pulse=machine.userData.feedPulse||0,spin=machine.userData.feedSpin||0;
  c.save();c.translate(p.x,p.y);c.scale(scale,scale);
  oval(c,0,.015,.77,.17,'#0c1210a0');
  // Four rugged wheels and the waist-high tripod keep the device planted.
  for(const x of [-.56,.56]){
    oval(c,x,-.13,.24,.24,'#071219');oval(c,x,-.13,.135,.14,'#4c6263');
    oval(c,x,-.13,.06,.07,'#b3cdc3');
  }
  c.strokeStyle='#637e75';c.lineWidth=.095;c.lineCap='round';
  c.beginPath();c.moveTo(-.26,-.60);c.lineTo(-.46,-.25);c.moveTo(.26,-.60);c.lineTo(.46,-.25);c.stroke();
  c.fillStyle=gradient(c,-.65,-1,-.10,-1,[[0,'#0a1b23'],[.5,'#284c52'],[1,'#0d2229']]);
  c.beginPath();c.roundRect(-.59,-1.28,1.18,.76,.13);c.fill();
  c.lineWidth=.045;c.strokeStyle='#8fa59b';c.stroke();
  // Rear hopper contains balls; paired flywheels propel each feed.
  c.fillStyle='#203b3d';c.beginPath();c.roundRect(-.40,-1.74,.80,.55,.09);c.fill();
  c.fillStyle='#a2ca54';for(let k=0;k<4;k++)oval(c,(k-1.5)*.18,-1.54,.094,.095,'#e1f276');
  for(const x of [-.28,.28]){
    oval(c,x,-.95,.25,.26,'#07151a');oval(c,x,-.95,.174,.178,'#546e67');
    c.strokeStyle='#a6d2bc';c.lineWidth=.032;c.beginPath();
    c.moveTo(x-.12*Math.cos(spin),-.95-.12*Math.sin(spin));
    c.lineTo(x+.12*Math.cos(spin),-.95+.12*Math.sin(spin));c.stroke();
  }
  c.fillStyle='#06161c';c.beginPath();c.roundRect(-.13,-1.11,.26,.28,.07);c.fill();
  c.fillStyle='#f0fc6f';oval(c,0,-1.02,.070,.071,pulse>.1?'#fffdb2':'#a4cd4e');
  c.fillStyle='#051b1a';c.beginPath();c.roundRect(-.27,-.71,.54,.145,.03);c.fill();
  c.fillStyle=pulse>.1?'#c8ff76':'#82cf99';c.font='900 .112px system-ui';c.textAlign='center';c.fillText('BALL FEED',0,-.61);
  c.fillStyle=pulse>.1?'#edff87':'#446f53';oval(c,.46,-1.19,.055,.055,pulse>.1?'#e8fb6d':'#4a965d');
  c.restore();
}
