/* World meters. +s is downhill along -Z. The foreground line is designed;
   the distant massif is built from the supplied, baked Matterhorn DEM. */
export const LENGTH=2800,START_ALT=3380,FINISH_ALT=2583;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const center=s=>56*Math.sin(s/310)+23*Math.sin(s/129);
export const tangent=s=>center(s+.5)-center(s-.5);
export const raceLine=s=>center(s)+Math.sin(s/82)*6.5+Math.sin(s/191)*2;
export const halfWidth=s=>28+8*Math.sin(s/420)**2-4*smooth(2150,2700,s);
export const RAMPS=[
 {s:185,height:6.2,run:24},{s:620,height:7.5,run:26},
 {s:1010,height:7.8,run:28},{s:1450,height:9,run:31},
 {s:1860,height:8.8,run:30},{s:2240,height:8.2,run:28}
];
export const BOOSTS=RAMPS.map((r,i)=>({s:r.s-52,index:i,length:22}));
export function baseHeight(s){
 if(s>LENGTH)return FINISH_ALT-30*(1-Math.exp(-(s-LENGTH)/350));
 const t=s/LENGTH;
 const rollers=5.2*Math.sin((s-22)/47)*smooth(24,130,s)*(1-smooth(2430,2800,s));
 return START_ALT-(START_ALT-FINISH_ALT)*t+23*Math.sin(t*Math.PI*2)+10*Math.sin(t*Math.PI*6)+rollers;
}
export function rampHeight(s){
 let h=0;
 for(const r of RAMPS){
  if(s>=r.s-r.run&&s<=r.s)h+=r.height*((s-r.s+r.run)/r.run)**2;
  else if(s>r.s&&s<r.s+58)h+=r.height*(1-smooth(r.s,r.s+58,s));
 }
 return h;
}
export function groundHeight(x,s){
 const u=x-center(s),w=halfWidth(s),out=Math.max(0,Math.abs(u)-w);
 const bank=.0053*Math.min(Math.abs(u),w)**2;
 const hills=110*(1-Math.exp(-out/500))+95*smooth(550,2500,out);
 const detail=(Math.sin(x*.12+s*.08)+.6*Math.sin(s*.21-x*.2))*.033;
 const ridges=(Math.sin(s*.006+u*.004)*32+Math.sin(s*.017-u*.009)*12)*smooth(12,190,out);
 return baseHeight(s)+rampHeight(s)+bank+hills+ridges+detail;
}
export function gradient(x,s){const e=.4;return {x:(groundHeight(x+e,s)-groundHeight(x-e,s))/(2*e),s:(groundHeight(x,s+e)-groundHeight(x,s-e))/(2*e)};}
export const COURSE_GLSL=`
float skiCenter(float s){return 56.*sin(s/310.)+23.*sin(s/129.);}
float skiWidth(float s){return 28.+8.*pow(sin(s/420.),2.)-4.*smoothstep(2150.,2700.,s);}
`;
export const SECTIONS=[
 {s:0,name:'The Drop-in',hint:'Fast from the first turn.'},
 {s:320,name:'The Bowl',hint:'Ride the banks. Find the rings.'},
 {s:890,name:'The Kicker',hint:'Follow the lime chevrons.'},
 {s:1610,name:'The Blue Ridge',hint:'Keep the stream alive.'},
 {s:2350,name:'Schwarzsee',hint:'Bring it home.'}
];
export function sectionAt(s){return SECTIONS.filter(v=>s>=v.s).at(-1)||SECTIONS[0];}
export function ringHeight(r,s){
 // Ring center follows the expected ballistic arc of a 31 m/s approach.
 const speed=31,t=(s-r.s)/speed;
 const vy=Math.max(5.5,speed*gradient(raceLine(r.s),r.s-.35).s+2.1);
 return groundHeight(raceLine(r.s),r.s)+vy*t-4.905*t*t+1.2-groundHeight(raceLine(s),s);
}
export function makeGates(difficulty='alpine'){
 const a=Array.from({length:36},(_,i)=>{
  const s=65+i*75;
  return {s,x:raceLine(s),half:8.7,y:4.6,kind:i%9===0?'arch':'flag'};
 });
 for(const [i,r]of RAMPS.entries()){
  const s=r.s+43;a.push({s,x:raceLine(s),half:8.6,y:ringHeight(r,s),kind:'ring',ramp:i});
 }
 return a.sort((a,b)=>a.s-b.s).map((g,index)=>{
  if(difficulty==='expert'&&g.kind==='flag')g={...g,x:clamp(g.x+(index%2?5.5:-5.5),center(g.s)-halfWidth(g.s)+9,center(g.s)+halfWidth(g.s)-9),half:6.8};
  return {...g,index,hit:false,missed:false};
 });
}
