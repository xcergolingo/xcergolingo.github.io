import assert from 'node:assert/strict';
import {makeChallenge,crossChallenge,obstacleX,nextDanger} from '../src/challenges.js';
import {makeGates,groundHeight,halfWidth,center,RAMPS} from '../src/course.js';
import {createSkier,stepSkier,flowSteer,crossGates} from '../src/physics.js';
import {makeLessonRun} from '../src/lesson-run.js';
import {parseLesson,DEMO_TEXT} from '../src/lessons.js';

const gates=makeGates(),alpine=makeChallenge(gates),expert=makeChallenge(gates,{difficulty:'expert'});
assert(alpine.obstacles.length>=4);assert(expert.obstacles.length>alpine.obstacles.length);
for(const c of [alpine,expert]){
 assert.deepEqual(new Set(c.obstacles.map(o=>o.type)),new Set(['safety-net']));assert.equal(c.shards.length,0);
 assert(c.obstacles.every(o=>Math.abs(o.x-center(o.s))-o.half>8),'chicanes extend from the margins and leave a full open lane');
 assert(c.obstacles.every(o=>gates.every(g=>Math.abs(g.s-o.s)>=18)),'circles remain unobstructed');
 assert(c.obstacles.every(o=>RAMPS.every(r=>o.s<=r.s-88||o.s>=r.s+115)),'jump landings remain clear');
 for(const o of c.obstacles)for(let time=0;time<12;time+=.2)assert(Math.abs(obstacleX(o,time)-center(o.s))+o.half<halfWidth(o.s),'moving obstacle stays inside piste');
}
function crossing(x,footY,s=100){const y=groundHeight(x,s)+footY;return {x,s:s+.5,y,prevX:x,prevY:y,vs:30,vx:0,boostTime:1};}
const rail={id:0,s:100,x:0,half:6,height:1.45,type:'safety-net',side:1,passed:false},shape=()=>({obstacles:[{...rail}],shards:[],expert:false});
let c=shape(),p=crossing(0,0);assert.equal(crossChallenge(c,p,99.5,1)[0].type,'obstacle-hit');assert(p.vs<30);assert.equal(crossChallenge(c,p,99.5,1).length,0,'one collision per object');
c=shape();p=crossing(0,2.2);assert.equal(crossChallenge(c,p,99.5,1)[0].type,'obstacle-jump');assert.equal(p.vs,30);
c=shape();p=crossing(7.2,0);assert.equal(crossChallenge(c,p,99.5,1)[0].type,'near-miss');
c=shape();p=crossing(15,0);assert.equal(crossChallenge(c,p,99.5,1)[0].type,'obstacle-clear');
assert.equal(obstacleX(rail,0),obstacleX(rail,1000),'course equipment stays fixed');
c=shape();assert(nextDanger(c,{s:30,x:0,vx:0,vs:30},1));assert.equal(nextDanger(c,{s:110,x:0,vx:0,vs:30},1),null);
// Include obstacles in actual fixed-step lesson runs. Clear routes must remain
// compatible with Flow Assist and every sentence word must remain reachable.
const runs=[];
for(const difficulty of ['alpine','expert'])for(const index of [0,1,2]){
 const r=makeLessonRun(parseLesson(DEMO_TEXT),index),q=createSkier();q.vs=Math.min(q.vs,r.maxSpeed*.85);q.vx=0;
 const c=makeChallenge(r.gates,{finishAt:r.finishAt,learning:true,difficulty});let hits=0,impacts=0;
 for(let i=0;i<120*300&&!q.finished;i++){
  const last=q.s;stepSkier(q,{steer:flowSteer(q,r.gates),maxSpeed:r.maxSpeed,finishAt:r.finishAt,learningPace:true},1/120);
  impacts+=crossChallenge(c,q,last,q.elapsed).filter(e=>e.type==='obstacle-hit').length;
  hits+=crossGates(r.gates,q,last).filter(e=>e.type==='gate').length;
 }
 assert(q.finished);assert.equal(hits,r.units.length,'all word rings reachable with obstacles');assert.equal(impacts,0,'assisted lesson corridor remains clear');
 runs.push({difficulty,sentence:index+1,wordRings:hits,obstacles:c.obstacles.length});
}
console.log(JSON.stringify({challengeChecks:'passed',alpine:alpine.obstacles.length,expert:expert.obstacles.length,collisionJumpNearMiss:'passed',learningRuns:runs}));
// Even an unreactive assisted skier can recover from obstacle impacts and
// complete the course. Sport riders can improve this by carving and hopping.
for(const difficulty of ['alpine','expert']){
 const q=createSkier(),g=makeGates(difficulty),c=makeChallenge(g,{difficulty});let impacts=0,hits=0;
 for(let i=0;i<120*300&&!q.finished;i++){
  const last=q.s;stepSkier(q,{steer:flowSteer(q,g)},1/120);
  impacts+=crossChallenge(c,q,last,q.elapsed).filter(e=>e.type==='obstacle-hit').length;hits+=crossGates(g,q,last).filter(e=>e.type==='gate').length;
 }
 assert(q.finished,difficulty+' recovers and finishes');assert(hits>25,'slalom remains achievable');
 console.log(JSON.stringify({fullChallenge:difficulty,seconds:Math.round(q.elapsed),gates:hits,recoverableImpacts:impacts}));
}
