export const GOAL_Z = -11.8;
export const GOAL_HEIGHT = 3.05;
export const BALL_RADIUS = .25;
export const BALL_START_Y = .29;
export const SHOT_STYLES = Object.freeze([
  { id: 'drive', name: 'Drive', description: 'Fast and low. Pick a clear gap between the defenders.' },
  { id: 'curl', name: 'Curl', description: 'Bend around the wall with a controlled, rising finish.' },
  { id: 'chip', name: 'Chip', description: 'Lift over low obstacles. Too much power sends it over the bar.' }
]);
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

export function shotProfile(style = 'curl', power = .72, practice = false) {
  const definition = SHOT_STYLES.find(item => item.id === style) || SHOT_STYLES[1];
  const parsedPower=Number(power), strength=clamp(Number.isFinite(parsedPower)?parsedPower:.72,.35,1);
  let duration,aimY;
  if(definition.id==='drive'){duration=.62+.32*(1-strength);aimY=.25+.55*strength;}
  else if(definition.id==='chip'){duration=1.25+.60*(1-strength);aimY=.65+3*strength*strength;}
  else {duration=.84+.40*(1-strength);aimY=.50+1.70*strength;}
  // Constant-gravity vertical motion, solved to meet the chosen height at the
  // goal. Practice slows the animation without changing the physical route.
  return {...definition,style:definition.id,power:strength,duration:duration*(practice?1.13:1),aimY,arc:.5*9.81*duration*duration};
}

export function shotPoint(t, shot, stage) {
  const profile=shotProfile(shot.style,shot.power),aimY=Number.isFinite(shot.aimY)?shot.aimY:profile.aimY;
  const arc=Number.isFinite(shot.arc)?shot.arc:profile.arc;
  return {
    x: stage.startX + (shot.x - stage.startX) * t + 2 * (1 - t) * t * (shot.bend||0),
    y: BALL_START_Y + (aimY-BALL_START_Y)*t + arc*t*(1-t),
    z: stage.startZ + (GOAL_Z - stage.startZ) * t
  };
}
// Invert the rendered flight surface instead of projecting a high chip onto
// the ground. The latter changes both target and bend as the ball gains height.
export function unprojectShotRay(origin,direction,stage,profile,previousT=0) {
  const defaults=shotProfile(profile?.style,profile?.power);
  const arc=Number.isFinite(profile?.arc)?profile.arc:defaults.arc;
  const dy=(Number.isFinite(profile?.aimY)?profile.aimY:defaults.aimY)-BALL_START_Y;
  const distance=stage.startZ-GOAL_Z,a=(stage.startZ-origin.z)/distance,b=-direction.z/distance;
  const A=arc*b*b,B=direction.y-(dy+arc)*b+2*arc*a*b;
  const C=origin.y-BALL_START_Y-(dy+arc)*a+arc*a*a;
  let roots=[];
  if(Math.abs(A)<1e-10){if(Math.abs(B)>1e-10)roots=[-C/B];}
  else {
    const discriminant=B*B-4*A*C;
    if(discriminant>=-1e-8){const d=Math.sqrt(Math.max(0,discriminant));roots=[(-B-d)/(2*A),(-B+d)/(2*A)];}
  }
  const progress=Number.isFinite(previousT)?previousT:0;
  const candidates=roots.filter(s=>s>=0).map(s=>({x:origin.x+direction.x*s,t:a+b*s})).filter(p=>p.t>=-.015&&p.t<=1.015&&p.t>=progress-1e-5).sort((p,q)=>p.t-q.t);
  if(!candidates.length)return null;
  // Near the net, a chip turns downwards on screen. Follow the forward branch
  // of the parabola so that this turn does not reverse the fitted finger stroke.
  const result=candidates[0];result.t=clamp(result.t,0,1);result.z=stage.startZ+(GOAL_Z-stage.startZ)*result.t;
  return result;
}
export function obstaclePosition(object, time) {
  return {
    x: (object.baseX ?? object.x ?? 0) + (object.moving && !object.hit ? Math.sin(time * (object.speed ?? .75) + (object.phase ?? 0)) * (object.amplitude ?? 1.4) : 0),
    z: object.baseZ ?? object.z ?? 0
  };
}
export function segmentHitsCircle(a, b, center, radius) {
  const dx = b.x-a.x, dz=b.z-a.z, square=dx*dx+dz*dz;
  const t = square ? Math.max(0,Math.min(1,((center.x-a.x)*dx+(center.z-a.z)*dz)/square)) : 0;
  return Math.hypot(a.x+t*dx-center.x,a.z+t*dz-center.z)<radius;
}
export function segmentHitsBox(a,b,center,width,depth,radius=BALL_RADIUS) {
  let near=0,far=1;
  for(const [key,size] of [['x',width],['z',depth]]) {
    const low=center[key]-size/2-radius,high=center[key]+size/2+radius;
    const delta=b[key]-a[key];
    if(Math.abs(delta)<1e-9){if(a[key]<low||a[key]>high)return false;}
    else {let t1=(low-a[key])/delta,t2=(high-a[key])/delta;if(t1>t2)[t1,t2]=[t2,t1];near=Math.max(near,t1);far=Math.min(far,t2);if(near>far)return false;}
  }
  return true;
}

function heightInterval(a,b,minY,maxY) {
  const ay=Number.isFinite(a.y)?a.y:BALL_START_Y,by=Number.isFinite(b.y)?b.y:ay,delta=by-ay;
  if(Math.abs(delta)<1e-9)return ay>=minY&&ay<=maxY?[0,1]:null;
  let enter=(minY-ay)/delta,leave=(maxY-ay)/delta;
  if(enter>leave)[enter,leave]=[leave,enter];
  enter=Math.max(0,enter);leave=Math.min(1,leave);
  return enter<=leave?[enter,leave]:null;
}
const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});

export function segmentHitsDefender(a,b,defender,timeStart=0,timeEnd=timeStart) {
  const height=defender.height??(defender.keeper?2.8:2.17),base=defender.baseY??0;
  const interval=heightInterval(a,b,base-BALL_RADIUS,base+height+BALL_RADIUS);
  if(!interval)return false;
  const p=obstaclePosition(defender,timeStart),q=obstaclePosition(defender,timeEnd);
  const relativeA={x:a.x-p.x,z:a.z-p.z},relativeB={x:b.x-q.x,z:b.z-q.z};
  return segmentHitsCircle(interpolate(relativeA,relativeB,interval[0]),interpolate(relativeA,relativeB,interval[1]),{x:0,z:0},(defender.radius??.55)+BALL_RADIUS);
}

export function segmentHitsObstacle(a,b,obstacle,timeStart=0,timeEnd=timeStart) {
  const base=obstacle.baseY??0,interval=heightInterval(a,b,base-BALL_RADIUS,base+(obstacle.height??1.1)+BALL_RADIUS);
  if(!interval)return false;
  const p=obstaclePosition(obstacle,timeStart),q=obstaclePosition(obstacle,timeEnd);
  const relativeA={x:a.x-p.x,z:a.z-p.z},relativeB={x:b.x-q.x,z:b.z-q.z};
  return segmentHitsBox(interpolate(relativeA,relativeB,interval[0]),interpolate(relativeA,relativeB,interval[1]),{x:0,z:0},obstacle.width,obstacle.depth);
}

export function goalOutcome(x, stage, y) {
  const distance=Math.abs(x-stage.goalX),post=stage.goalWidth/2;
  if(Number.isFinite(y)){
    const bar=stage.goalHeight??GOAL_HEIGHT;
    if(y>bar+BALL_RADIUS+.09)return 'high';
    if(distance<post+BALL_RADIUS+.09&&Math.abs(y-bar)<BALL_RADIUS+.09)return 'crossbar';
    if(y<BALL_RADIUS-.04)return 'low';
  }
  if(Math.abs(distance-post)<BALL_RADIUS+.09)return 'post';
  if(distance>post-BALL_RADIUS)return 'wide';
  return 'goal';
}
export function bonusOutcome(x,y,stage) {
  return !!stage.bonus&&Math.hypot(x-stage.bonus.x,y-stage.bonus.y)<=stage.bonus.radius;
}
// Fit the drawn route itself, including a swipe released before the goal.
export function fitSwipe(points,startX,fallbackX,fallbackBend=0) {
  let tt=0,tk=0,kk=0,tx=0,kx=0,minT=1,maxT=0;
  for(const point of points){
    if(point.t<.04||point.t>1)continue;
    const t=point.t,k=2*t*(1-t),x=point.x-startX;
    tt+=t*t;tk+=t*k;kk+=k*k;tx+=t*x;kx+=k*x;minT=Math.min(minT,t);maxT=Math.max(maxT,t);
  }
  const determinant=tt*kk-tk*tk;
  if(maxT-minT>.22&&determinant>1e-5)return {x:startX+(tx*kk-kx*tk)/determinant,bend:(kx*tt-tx*tk)/determinant};
  return {x:fallbackX,bend:kk>.005?(kx-(fallbackX-startX)*tk)/kk:fallbackBend};
}
