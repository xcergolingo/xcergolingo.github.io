import {LENGTH,raceLine,groundHeight,clamp} from './course.js';
import {createSkier,stepSkier,flowSteer} from './physics.js';
import {lessonRun} from './lessons.js';
export function makeLessonRun(lesson,index=0){
 const run=lessonRun(lesson,index),n=run.units.length;
 const finishAt=Math.min(LENGTH,Math.max(560,220+n*94));
 const spacing=(finishAt-160)/n;
 const avg=run.units.reduce((sum,u)=>sum+Math.max(.45,Math.min(3.8,.35+Array.from(u.text).length*.065)),0)/n;
 const maxSpeed=clamp(spacing/(avg*2+.8),4.5,26);
 const gates=run.units.map((unit,i)=>{const s=80+(i+.5)*spacing;return {index:i,s,x:raceLine(s),half:10.8,y:7.1,kind:'ring',ramp:i,learning:true,unit,hit:false,missed:false};});
 // Use the real ski simulator to place learning circles on the expected flight
 // arc, so a word ring after a kicker is physically reachable.
 const p=createSkier();p.vs=Math.min(p.vs,maxSpeed*.85);p.vx=0;
 for(let i=0;i<120*1300&&!p.finished;i++){
  const last=p.s;stepSkier(p,{steer:flowSteer(p,gates),maxSpeed,finishAt,learningPace:true},1/120);
  for(const g of gates)if(last<g.s&&p.s>=g.s)g.y=Math.max(7.1,p.y-groundHeight(g.x,g.s)+4.6);
 }
 return {...run,gates,finishAt,maxSpeed};
}
