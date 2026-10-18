// CPU scene construction checks. This is not a browser or GPU rendering test.
import {build} from 'esbuild';
import assert from 'node:assert/strict';
const fakeContext=new Proxy({}, {get(o,k){
 if(k==='measureText')return text=>({width:Array.from(text).length*42});
 if(k==='createRadialGradient')return ()=>({addColorStop(){}});
 if(k==='createImageData')return (w,h)=>({data:new Uint8ClampedArray(w*h*4)});
 return o[k]??(()=>{});
},set(o,k,v){o[k]=v;return true;}});
globalThis.document={createElement:()=>({width:128,height:128,getContext:()=>fakeContext})};
const result=await build({stdin:{contents:`
 import * as THREE from 'three';
 import {buildTerrain,PEAK} from './src/terrain.js';
 import {buildCourse,buildDetails,buildSky,addLights} from './src/world.js';
 import {createPOV} from './src/pov.js';
 import {makeGates} from './src/course.js';
 import {parseLesson,SENTENCE_EXAMPLE} from './src/lessons.js';
 import {makeLessonRun} from './src/lesson-run.js';
 import {makeChallenge} from './src/challenges.js';
 import {buildObstacles} from './src/obstacles.js';
 export {THREE,buildTerrain,PEAK,buildCourse,buildDetails,buildSky,addLights,createPOV,makeGates,parseLesson,SENTENCE_EXAMPLE,makeLessonRun,makeChallenge,buildObstacles};
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,minify:true,logLevel:'silent'});
const lib=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const scene=new lib.THREE.Scene(),gates=lib.makeGates();
lib.buildTerrain(scene);const objects=lib.buildCourse(scene,gates);const finishPortal=lib.buildDetails(scene);lib.buildSky(scene);lib.addLights(scene);
const camera=new lib.THREE.PerspectiveCamera(80,16/9,.065,45000),pov=lib.createPOV(camera);scene.add(camera);
let meshes=0,vertices=0,peakY=0;
scene.traverse(o=>{
 if(!o.isMesh)return;meshes++;const p=o.geometry.attributes.position;if(!p)return;vertices+=p.count;
 for(let i=0;i<p.array.length;i++)assert(Number.isFinite(p.array[i]),'finite mesh positions');
 if(o.isInstancedMesh)for(const v of o.instanceMatrix.array)assert(Number.isFinite(v),'finite instance matrices');
});
assert.equal(objects.length,42);assert.equal(gates.filter(g=>g.kind==='ring').length,6);
// Both glove centers must remain in the frustum, in portrait and landscape.
for(const aspect of [.462, .75, 1.778, 2.165]){
 camera.aspect=aspect;camera.updateProjectionMatrix();pov.update({speed:25,steer:0,grounded:true},0,aspect);camera.updateMatrixWorld(true);
 const handGroups=pov.rig.children.filter(o=>o.isGroup&&o.children.length>5);
 assert.equal(handGroups.length,2);
 for(const hand of handGroups){const p=hand.getWorldPosition(new lib.THREE.Vector3()).project(camera);assert(Math.abs(p.x)<.96&&Math.abs(p.y)<.96,'POV gloves visible');}
}
assert.equal(lib.PEAK.y,4478);
finishPortal.setFinish(560,true,{text:'Me gusta esquiar.',translation:'I like skiing.'});assert.equal(finishPortal.sentenceText,'Me gusta esquiar.','finish gantry carries the complete sentence');
let finishSign;scene.traverse(o=>{if(o.userData.text==='Me gusta esquiar.')finishSign=o;});assert(finishSign);finishPortal.update({s:450},false);assert(!finishSign.visible);finishPortal.update({s:450},true);assert(finishSign.visible,'sentence is visible above the last line after word rings');
finishPortal.setFinish(2800,false);assert.equal(finishPortal.sentenceText,'','free ski clears the previous lesson banner');
// Starting/restarting a lesson must remove old circles and create readable
// word sprites without also rebuilding the static fences and decorations.
const before=scene.children.length,r=lib.makeLessonRun(lib.parseLesson(lib.SENTENCE_EXAMPLE));
const words=lib.buildCourse(scene,r.gates,{environment:false});assert.equal(scene.children.length,before+r.gates.length*2);
words.update(0,{s:12},.35,true);assert(words[0].wordSprite?.isSprite,'next word is centered in its ring');
const material=words[0].wordSprite.material;let disposed=false;material.addEventListener('dispose',()=>disposed=true);
words.update(1,{s:12},.35,false);assert(disposed,'translation changes replace the label texture');
words.dispose();assert.equal(words.length,0);assert.equal(scene.children.length,before,'lesson props fully removed');
const freeCount=objects.length;objects.dispose();assert.equal(objects.length,0,'free-ski gates can be removed before any labels exist');
const childCount=scene.children.length,challenge=lib.makeChallenge(lib.makeGates(),{difficulty:'expert'}),hazards=lib.buildObstacles(scene,challenge);
hazards.update(4,{s:350},.35);scene.updateMatrixWorld(true);
scene.traverse(o=>{if(!o.geometry)return;for(const x of o.geometry.attributes.position?.array||[])assert(Number.isFinite(x),'finite obstacle geometry');});
hazards.dispose();assert.equal(scene.children.length,childCount,'obstacle props are fully removed on restart');
console.log(JSON.stringify({sceneCheck:'passed',meshes,vertices,gates:freeCount,aerialRings:6,portraitPOV:'passed',learningLabels:'passed',restartCleanup:'passed',gpuRendering:'not tested'}));
