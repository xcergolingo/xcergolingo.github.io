import assert from 'node:assert/strict';
import {parseLesson,lessonRun,lessonRunCount,lessonJSON,DEMO_TEXT,SENTENCE_EXAMPLE,lessonFromURL} from '../src/lessons.js';
import {makeLessonRun} from '../src/lesson-run.js';
import {createSkier,stepSkier,crossGates,flowSteer} from '../src/physics.js';

const demo=parseLesson('\uFEFF'+DEMO_TEXT);
const shared={learningLanguage:'ja',primaryLanguage:'en',words:[{word:'水',translation:'water'}]};
assert.equal(lessonFromURL({hash:'#golingoLesson='+encodeURIComponent(JSON.stringify(shared))}).items[0].text,'水');assert.equal(lessonFromURL({search:'?lesson='+encodeURIComponent(JSON.stringify(shared))}).translationLanguage,'en');assert.equal(lessonFromURL({hash:''}),null);
assert.equal(demo.items.length,3);assert.equal(demo.language,'es-ES');
assert.deepEqual(lessonRun(demo,0).units.map(u=>u.text),['Me','gusta','esquiar']);
assert.equal(lessonRun(demo,1).text,'La montaña es hermosa.');
assert.equal(lessonRunCount(demo),3);
assert.deepEqual(parseLesson(JSON.stringify(lessonJSON(demo))),demo);
const words=parseLesson('words/phrases\nlanguage: fr-FR\nbonjour\thello\ns’il vous plaît | please');
assert.equal(words.mode,'phrases');assert.equal(words.items[0].translation,'hello');
assert.equal(lessonRun(words).units[1].text,'s’il vous plaît');
assert.equal(parseLesson('type: sentences\n# comment\nHello there. => Hola.').items[0].translation,'Hola.');
assert.equal(parseLesson([{word:'good morning',meaning:'buenos días'}],{mode:'phrases',language:'en-US'}).items[0].text,'good morning');
assert.equal(parseLesson({sentences:[{sentence:'We ski.',translated:'Esquiamos.'}],lang:'en-US'}).mode,'sentences');
assert.equal(parseLesson({words:['uno','dos']}).mode,'phrases');
const explicit=parseLesson(SENTENCE_EXAMPLE);assert.equal(lessonRun(explicit).units[2].translation,'to ski');
assert.equal(lessonRun(parseLesson('sentences\nlanguage: ja-JP\n明日は山でスキーをします。 | Tomorrow I will ski in the mountains.')).units.map(u=>u.text).join(''),'明日は山でスキーをします');
const large=parseLesson({type:'phrases',items:Array.from({length:100},(_,i)=>({text:'item '+i,translation:'meaning '+i}))});
assert.equal(lessonRunCount(large),3);assert.equal(lessonRun(large,0).units.length,48);assert.equal(lessonRun(large,2).units.length,4);
assert.equal(lessonRun(large,2).units[3].text,'item 99');
for(const bad of ['', '{bad}',{items:[]},{items:[{}]},'sentences\n!!!',{items:['hi'],language:'nonsense_invalid'}, {items:Array(1001).fill('hi')}])assert.throws(()=>parseLesson(bad));
assert.throws(()=>parseLesson({items:[Array(241).fill('word').join(' ')]}),/240/);

// Drive the actual skier through every learning circle using Flow Assist. This
// catches unreachable labels/rings around jump arcs and dropped lesson units.
const results=[];
for(const [name,input] of [
 ['one word','sentences\nHola. | Hello.'],
 ['three words',DEMO_TEXT],
 ['long sentence','sentences\n'+Array(30).fill('montaña').join(' ')],
 ['dense sentence','sentences\n'+Array(240).fill('ski').join(' ')],
 ['phrases',{type:'phrases',items:Array.from({length:48},(_,i)=>({text:'buenos días '+i}))}]
]){
 const lesson=parseLesson(input),r=makeLessonRun(lesson),p=createSkier();p.vs=Math.min(p.vs,r.maxSpeed*.85);p.vx=0;
 let hit=0,miss=0;
 for(let i=0;i<120*1300&&!p.finished;i++){
  const last=p.s;stepSkier(p,{steer:flowSteer(p,r.gates),maxSpeed:r.maxSpeed,finishAt:r.finishAt,learningPace:true},1/120);
  for(const e of crossGates(r.gates,p,last)){if(e.type==='gate')hit++;else miss++;}
 }
 assert(p.finished,name+' finishes');assert.equal(p.s,r.finishAt);assert.equal(r.gates.length,r.units.length);
 assert.equal(hit,r.units.length,name+' collects every word');assert.equal(miss,0,name+' no missed rings');
 assert(r.gates.every(g=>g.s<r.finishAt&&Number.isFinite(g.y)));
 results.push({name,rings:hit,seconds:Math.round(p.elapsed),maxKmh:Math.round(r.maxSpeed*3.6)});
}
console.log(JSON.stringify({lessonFormats:'passed',unicode:'passed',roundtrip:'passed',learningRuns:results}));
