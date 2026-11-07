/** Pure survival rules. No rendering, browser APIs, or timers: easy to rebalance and test. */
export const MAGAZINE = 6;
export const MAX_HEALTH = 40;
export const CAMPAIGN_WAVES = 5;
export const SHELL_SECONDS = 0.66;
export const SHOT_SECONDS = 0.79;

const BASE_WAVES = [
  ['zombie','zombie','crawler','zombie','zombie','crawler'],
  ['zombie','crawler','zombie','runner','zombie','crawler','zombie','runner','zombie'],
  ['zombie','runner','crawler','zombie','brute','crawler','runner','zombie','crawler','runner','zombie','zombie','runner'],
  ['runner','zombie','crawler','brute','zombie','runner','crawler','zombie','runner','crawler','brute','zombie','runner','crawler','runner','zombie'],
  ['zombie','runner','crawler','brute','runner','zombie','crawler','runner','brute','crawler','runner','zombie','crawler','brute','runner','zombie','runner','crawler','brute','runner','zombie']
];

export function wavePlan(wave) {
  if (wave <= CAMPAIGN_WAVES) return [...BASE_WAVES[Math.max(0,wave-1)]];
  const count = Math.min(36,21 + (wave-5)*3);
  return Array.from({length:count},(_,i)=>i%7===0?'brute':i%3===0?'runner':i%4===0?'crawler':'zombie');
}

export class SurvivalRules {
  constructor(){ this.reset(); }
  reset(){
    Object.assign(this,{health:MAX_HEALTH,integrity:100,shells:MAGAZINE,reserve:30,score:0,kills:0,wave:0,cleared:0,
      phase:'ready',countdown:0,queue:[],spawned:0,spawnClock:0,shotClock:0,reloading:false,reloadClock:0,
      supplyUsed:false,endless:false,campaignWaves:CAMPAIGN_WAVES,time:0,lastDamage:-100});
  }
  start(){this.reset();this.phase='intermission';this.countdown=7;}
  get over(){return this.phase==='lost'||this.phase==='won';}
  get reloadPhase(){return this.reloading?Math.min(1,this.reloadClock/SHELL_SECONDS):0;}
  get enemiesRemaining(){return this.queue.length-this.spawned;}
  beginReload(){
    if(this.over||this.phase==='ready'||this.reloading||this.shells>=MAGAZINE||this.reserve<=0)return false;
    this.reloading=true;this.reloadClock=0;return true;
  }
  fire(){
    if(this.over||this.phase==='ready'||this.shotClock>0||this.shells<=0)return false;
    this.reloading=false;this.reloadClock=0;this.shells--;this.shotClock=SHOT_SECONDS;return true;
  }
  damageHealth(amount){
    if(this.over||this.phase==='ready')return;
    this.health=Math.max(0,this.health-amount);this.lastDamage=this.time;
    if(this.health<=0)this.phase='lost';
  }
  damageStore(amount){
    if(this.phase!=='combat')return;
    this.integrity=Math.max(0,this.integrity-amount);
    if(this.integrity<=0)this.phase='lost';
  }
  addKill(points=100){if(this.over)return;this.kills++;this.score+=points;}
  useSupplies(){
    if(this.phase!=='intermission'||this.supplyUsed)return false;
    this.health=Math.min(MAX_HEALTH,this.health+16);this.integrity=Math.min(100,this.integrity+20);
    this.reserve=Math.min(96,this.reserve+12);this.supplyUsed=true;return true;
  }
  addPickup(kind){
    if(this.over)return;
    if(kind==='health')this.health=Math.min(MAX_HEALTH,this.health+10);
    else this.reserve=Math.min(96,this.reserve+6);
  }
  continueEndless(){
    if(this.phase!=='won')return false;
    this.endless=true;this.phase='intermission';this.countdown=13;this.supplyUsed=false;
    this.health=Math.min(MAX_HEALTH,this.health+15);this.integrity=Math.min(100,this.integrity+20);this.reserve=Math.min(96,this.reserve+24);return true;
  }
  /** Advance time and return discrete events consumed by rendering/audio. */
  tick(dt,alive){
    const events=[];if(this.over||this.phase==='ready')return events;
    this.time+=dt;this.shotClock=Math.max(0,this.shotClock-dt);
    if(this.reloading){
      this.reloadClock+=dt;
      while(this.reloading&&this.reloadClock>=SHELL_SECONDS){
        this.reloadClock-=SHELL_SECONDS;this.shells++;this.reserve--;events.push({type:'shell'});
        if(this.shells>=MAGAZINE||this.reserve<=0){this.reloading=false;this.reloadClock=0;events.push({type:'reloadDone'});}
      }
    }
    if(this.phase==='intermission'){
      this.countdown=Math.max(0,this.countdown-dt);
      if(this.countdown===0){
        this.wave++;this.queue=wavePlan(this.wave);this.spawned=0;this.spawnClock=.4;this.phase='combat';events.push({type:'wave',wave:this.wave});
      }
    }else if(this.phase==='combat'){
      this.spawnClock-=dt;
      if(this.spawned<this.queue.length&&this.spawnClock<=0){
        events.push({type:'spawn',kind:this.queue[this.spawned],index:this.spawned});this.spawned++;
        this.spawnClock=Math.max(.85,2.1-this.wave*.18);
      }
      if(this.spawned===this.queue.length&&alive===0&&!events.some(e=>e.type==='spawn')){
        this.cleared=this.wave;this.score+=300+Math.round(this.integrity)*2;
        if(this.wave>=this.campaignWaves&&!this.endless){this.phase='won';events.push({type:'won'});}
        else{
          this.phase='intermission';this.countdown=13;this.supplyUsed=false;this.reserve=Math.min(96,this.reserve+14+this.wave*2);
          this.health=Math.min(MAX_HEALTH,this.health+4);events.push({type:'clear',wave:this.wave});
        }
      }
    }
    return events;
  }
}
