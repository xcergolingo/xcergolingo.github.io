/* Fixed-step custom ski physics. Terrain gradients accelerate the skis;
   edged momentum follows the chosen heading, and flight is fully ballistic. */
import {LENGTH,center,tangent,raceLine,halfWidth,groundHeight,gradient,RAMPS,BOOSTS,clamp} from './course.js';
export function createSkier(){
 const s=12,x=raceLine(s),vs=13.5;
 return {s,x,y:groundHeight(x,s),vx:vs*tangent(s),vs,vy:0,steer:0,speed:vs,grounded:true,
  air:0,totalAir:0,bestAir:0,topSpeed:0,barrierCooldown:0,hopCooldown:0,boostTime:0,boostsMask:0,elapsed:0,finished:false};
}
export function stepSkier(p,input,dt){
 if(p.finished)return [];
 const events=[],lastS=p.s;p.prevX=p.x;p.prevY=p.y;dt=clamp(dt,0,1/30);
 p.elapsed+=dt;p.barrierCooldown=Math.max(0,p.barrierCooldown-dt);p.hopCooldown=Math.max(0,p.hopCooldown-dt);p.boostTime=Math.max(0,p.boostTime-dt);
 p.steer+=(clamp(input.steer||0,-1,1)-p.steer)*(1-Math.exp(-dt*9));
 const v=Math.hypot(p.vx,p.vs),brake=!!input.brake;
 if(p.grounded){
  const g=gradient(p.x,p.s),den=1+g.x*g.x+g.s*g.s;
  const target=p.vs*(tangent(p.s)+Math.tan(p.steer*.55));
  p.vx+=(target-p.vx)*(1-Math.exp(-dt*4.3));
  p.vx-=9.81*g.x/den*dt;p.vs-=9.81*g.s/den*dt;
  const drag=(input.tuck?.00135:.0018)*v*v+.10+Math.abs(p.steer)*.25+(brake?6+v*.78:0);
  const scale=Math.max(0,1-drag*dt/Math.max(1,v));p.vs=Math.max(0,p.vs*scale);p.vx*=scale;
  if(input.hop&&p.hopCooldown===0&&v>2){p.vy=4.8;p.grounded=false;p.air=0;p.hopCooldown=1.25;events.push({type:'takeoff'});}
 }else{p.vx+=p.steer*.9*dt;p.vs*=1-.00022*v*dt;p.vy-=9.81*dt;}
 // Very dense lessons use a gentle crawl pace. Keep them moving over a
 // rising jump lip; the Brake control still stops the skis completely.
 if(input.learningPace&&!brake&&p.grounded)p.vs=Math.max(Math.min(4.5,input.maxSpeed??43),p.vs);
 p.s+=p.vs*dt;p.x+=p.vx*dt;
 if(p.grounded){
  p.y=groundHeight(p.x,p.s);
  for(const r of RAMPS)if(lastS<r.s&&p.s>=r.s&&p.vs>8){
   p.vy=Math.max(5.5,p.vs*gradient(p.x,r.s-.35).s+2.1);p.grounded=false;p.air=0;events.push({type:'takeoff',ramp:true});break;
  }
  for(const b of BOOSTS)if(!(p.boostsMask&(1<<b.index))&&lastS<b.s&&p.s>=b.s){
   p.boostsMask|=1<<b.index;
   if(!brake&&Math.abs(p.x-raceLine(p.s))<11){p.vs=Math.min(41,p.vs+3.6);p.boostTime=1.45;events.push({type:'boost',index:b.index});}
  }
 }else{
  p.y+=p.vy*dt;p.air+=dt;p.totalAir+=dt;p.bestAir=Math.max(p.bestAir,p.air);
  const floor=groundHeight(p.x,p.s);
  if(p.y<=floor){const impact=Math.abs(p.vy);p.y=floor;p.vy=0;p.grounded=true;events.push({type:'land',impact,air:p.air});p.air=0;p.vs*=clamp(1-impact*.003,.87,1);}
 }
 const c=center(p.s),limit=halfWidth(p.s)-.8;
 if(Math.abs(p.x-c)>limit){
  const side=Math.sign(p.x-c);p.x=c+side*limit;p.vx=-side*Math.max(1.2,Math.abs(p.vx)*.28);
  if(p.barrierCooldown===0){p.vs*=.66;p.barrierCooldown=.9;p.boostTime=0;events.push({type:'barrier',side});}
 }
 p.vs=Math.min(input.maxSpeed??43,p.vs);p.speed=Math.hypot(p.vx,p.vs);p.topSpeed=Math.max(p.topSpeed,p.speed);
 const finishAt=input.finishAt??LENGTH;
 if(p.s>=finishAt){p.s=finishAt;p.finished=true;events.push({type:'finish'});}
 if(![p.s,p.x,p.y,p.vx,p.vs,p.vy].every(Number.isFinite))throw Error('Non-finite ski state');return events;
}
export function crossGates(gates,p,lastS){
 const out=[];
 for(const g of gates)if(!g.hit&&!g.missed&&lastS<g.s&&p.s>=g.s){
  // Solve the crossing at the gate plane rather than using an entire-frame endpoint.
  const t=clamp((g.s-lastS)/Math.max(.00001,p.s-lastS),0,1);
  const x=p.prevX===undefined?p.x:p.prevX+(p.x-p.prevX)*t,y=p.prevY===undefined?p.y:p.prevY+(p.y-p.prevY)*t;
  const dx=x-g.x,floor=groundHeight(g.x,g.s),dy=y+1.15-floor-g.y;
  const inside=g.kind==='ring'?dx*dx+dy*dy<(g.half-.3)**2:Math.abs(dx)<g.half-.4&&(g.kind==='flag'||p.y-floor<10.8);
  g.hit=inside;g.missed=!inside;out.push({type:inside?'gate':'miss',gate:g});
 }return out;
}
export function flowSteer(p,gates){
 const next=gates.find(g=>!g.hit&&!g.missed&&g.s>=p.s),look=Math.min(28,Math.max(9,p.vs*.62));
 let target=raceLine(p.s+look);if(next&&next.s-p.s<look)target=next.x;
 // Edge input is still physical. Assist is a gentle heading correction, and
 // user steering always replaces it instead of fighting an autopilot.
 return clamp((target-p.x-tangent(p.s)*look)/Math.max(6,look)*1.12,-.65,.65);
}
