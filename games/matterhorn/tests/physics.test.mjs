import assert from 'node:assert/strict';
import {createSkier,stepSkier,crossGates,flowSteer} from '../src/physics.js';
import {groundHeight,makeGates,LENGTH,RAMPS} from '../src/course.js';
function run(flow){
 const p=createSkier(),gates=makeGates();let launches=0,lands=0,hits=0,rings=0,boosts=0,collisions=0;
 for(let i=0;i<120*200&&!p.finished;i++){
  const last=p.s,g=gates.find(g=>g.s>p.s);
  const steer=flow?flowSteer(p,gates):Math.max(-.8,Math.min(.8,((g?.x??p.x)-p.x)*.045));
  for(const e of stepSkier(p,{steer},1/120)){
   if(e.type==='takeoff')launches++;if(e.type==='land')lands++;if(e.type==='boost')boosts++;if(e.type==='barrier')collisions++;
  }
  for(const e of crossGates(gates,p,last))if(e.type==='gate'){hits++;if(e.gate.kind==='ring')rings++;}
  assert(p.speed<65);assert(p.y>=groundHeight(p.x,p.s)-.2);
 }
 assert(p.finished);assert.equal(p.s,LENGTH);assert(launches>=RAMPS.length);assert(lands>=RAMPS.length);assert(hits>30);assert(rings>=5);assert(boosts>=5);assert.equal(collisions,0);
 return {mode:flow?'flow':'sport simulation',seconds:+p.elapsed.toFixed(1),topKmh:+(p.topSpeed*3.6).toFixed(1),launches,lands,hits,rings,boosts};
}
const results=[run(true),run(false)];
// Holding a hard edge must collide and remain finite; braking must hold a stop.
const q=createSkier();let impacts=0;for(let i=0;i<120*14;i++)impacts+=stepSkier(q,{steer:1},1/120).filter(e=>e.type==='barrier').length;
assert(impacts>0);assert(Number.isFinite(q.x));
const b=createSkier();b.vs=30;for(let i=0;i<120*6;i++)stepSkier(b,{brake:true},1/120);assert(b.speed<2);
// A fresh run must clear one-shot boost usage and all gate outcomes.
assert.equal(createSkier().boostsMask,0);assert(makeGates().every(g=>!g.hit&&!g.missed));
// Merely crossing the same distance, above an aerial ring, must not collect it.
const g=makeGates().find(g=>g.kind==='ring'),bad={x:g.x,s:g.s+.01,y:groundHeight(g.x,g.s)+g.y+g.half+10};
assert.equal(crossGates([g],bad,g.s-.01)[0].type,'miss');
console.log(JSON.stringify({passed:true,runs:results,barrierImpacts:impacts}));
