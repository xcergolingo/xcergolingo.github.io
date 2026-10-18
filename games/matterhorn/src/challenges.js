/* Marked piste chicanes. Fixed safety nets extend from alternate sides of
   the run; jumps, landings and word rings always retain clear space. */
import {LENGTH,RAMPS,center,halfWidth,groundHeight,clamp,mix,tangent} from './course.js';
export function makeChallenge(gates,{finishAt=LENGTH,learning=false,difficulty='alpine'}={}){
 const expert=difficulty==='expert',obstacles=[],shards=[];
 const stations=expert?[88,326,402,476,752,824,1226,1304,1642,1724,2026,2110,2446,2524,2602]:[88,326,476,752,1226,1642,2026,2446,2602];
 for(const s of stations){
  if(s>finishAt-65||gates.some(g=>Math.abs(g.s-s)<18)||RAMPS.some(r=>s>r.s-88&&s<r.s+115))continue;
  const side=obstacles.length%2?1:-1,half=learning?4.2:expert?8:5.5;
  obstacles.push({id:obstacles.length,s,side,x:center(s)+side*(halfWidth(s)-half-1),type:'safety-net',half,height:1.45,passed:false,hit:false});
 }
 return {obstacles,shards,expert,learning};
}
export const obstacleX=o=>o.x;
export function crossChallenge(challenge,p,lastS,time,dt=1/120){
 const events=[];
 for(const o of challenge.obstacles)if(!o.passed&&lastS<o.s&&p.s>=o.s){
  o.passed=true;const t=clamp((o.s-lastS)/Math.max(.00001,p.s-lastS),0,1),x=mix(p.prevX??p.x,p.x,t),y=mix(p.prevY??p.y,p.y,t);
  const dx=Math.abs(x-o.x),height=y-groundHeight(x,o.s),radius=o.half+.55;
  if(dx<radius&&height<o.height+.12){o.hit=true;p.vs*=challenge.expert?.64:.72;p.vx+=(x<o.x?-1:1)*1.5;p.boostTime=0;p.speed=Math.hypot(p.vs,p.vx);events.push({type:'obstacle-hit',obstacle:o});}
  else{const jump=dx<radius&&height>=o.height+.12,near=!jump&&dx<radius+2.2&&height<o.height+1.2;events.push({type:jump?'obstacle-jump':near?'near-miss':'obstacle-clear',obstacle:o});}
 }
 return events;
}
export function nextDanger(challenge,p){
 const heading=Number.isFinite(p.vx)?p.vx/Math.max(4,p.vs||4):tangent(p.s);
 return challenge.obstacles.find(o=>!o.passed&&o.s>p.s&&o.s-p.s<100&&Math.abs(p.x+(o.s-p.s)*heading-o.x)<o.half+3)||null;
}
