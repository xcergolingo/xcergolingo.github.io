/* All audio is synthesized locally after a user gesture. No media downloads. */
export class MountainAudio{
 constructor(){this.enabled=true;this.ctx=null;}
 async start(){
  if(!this.enabled)return;
  try{
   if(!this.ctx){
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=.5;this.master.connect(c.destination);
    const buf=c.createBuffer(1,c.sampleRate*3,c.sampleRate),a=buf.getChannelData(0);let prev=0;
    for(let i=0;i<a.length;i++){prev=(prev+(Math.random()*2-1)*.07)/1.03;a[i]=prev*3;}
    const wind=c.createBufferSource();wind.buffer=buf;wind.loop=true;const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=750;
    this.wind=c.createGain();this.wind.gain.value=0;wind.connect(filter).connect(this.wind).connect(this.master);wind.start();
    const edge=c.createBufferSource();edge.buffer=buf;edge.loop=true;const hp=c.createBiquadFilter();hp.type='highpass';hp.frequency.value=950;
    this.edge=c.createGain();this.edge.gain.value=0;edge.connect(hp).connect(this.edge).connect(this.master);edge.start();
   }
   await this.ctx.resume();
  }catch{/* Audio remains optional on browsers with strict audio policies. */}
 }
 update(p,active,voiceSpeaking=false){if(!this.ctx)return;const t=this.ctx.currentTime;this.master.gain.setTargetAtTime(this.enabled?(voiceSpeaking?.12:.32):0,t,.12);this.wind.gain.setTargetAtTime(active?Math.min(.55,.035+p.speed*.014):.01,t,.2);this.edge.gain.setTargetAtTime(active&&p.grounded?Math.abs(p.steer)*p.speed*.009:0,t,.06);}
 chime(mult=1){if(!this.ctx||!this.enabled)return;const c=this.ctx,t=c.currentTime;for(let i=0;i<3;i++){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=(i===0?659.25:i===1?987.77:1318.51)*(1+Math.min(mult-1,6)*.025);g.gain.setValueAtTime(0,t+i*.045);g.gain.linearRampToValueAtTime(.07/(i+1),t+.008+i*.045);g.gain.exponentialRampToValueAtTime(.001,t+.75+i*.045);o.connect(g).connect(this.master);o.start(t+i*.045);o.stop(t+1+i*.045);}}
 boost(){if(!this.ctx||!this.enabled)return;const c=this.ctx,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(590,t+.32);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.08,t+.07);g.gain.exponentialRampToValueAtTime(.001,t+.45);o.connect(g).connect(this.master);o.start();o.stop(t+.47);}
 impact(){if(!this.ctx||!this.enabled)return;const c=this.ctx,o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type='sine';o.frequency.setValueAtTime(90,t);o.frequency.exponentialRampToValueAtTime(34,t+.16);g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.24);o.connect(g).connect(this.master);o.start();o.stop(t+.26);}
 toggle(){this.enabled=!this.enabled;if(this.enabled)this.start();return this.enabled;}
}
