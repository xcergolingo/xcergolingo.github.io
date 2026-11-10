import * as THREE from './vendor/three.module.js';

export const CAMERA_VIEWS=Object.freeze([
  {id:'ground',label:'Ground controller',short:'Ground'},
  {id:'chase',label:'Chase',short:'Chase'},
  {id:'cockpit',label:'Cockpit',short:'Cockpit'},
  {id:'nose',label:'Nose',short:'Nose'},
  {id:'leftWing',label:'Left wing',short:'Left wing'},
  {id:'rightWing',label:'Right wing',short:'Right wing'},
  {id:'tail',label:'Tail',short:'Tail'}
]);
export const CAMERA_IDS=Object.freeze(CAMERA_VIEWS.map(view=>view.id));
export const ONBOARD_CAMERA_IDS=Object.freeze(CAMERA_IDS.filter(id=>id!=='ground'&&id!=='chase'));
export const CONTROLLER_POSITION=Object.freeze([-24,1.75,78]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Old models have simple enclosed canopies, so their cockpit camera sits just
// above the canopy. The detailed jets supply their own cockpit eye points.
export function getCameraMounts(aircraft){
  const {type='trainer',span=3.45,length=2.7}=aircraft.userData;
  const wingHeight=type==='trainer'?.55:type==='glider'?.45:.27;
  return {
    cockpit:{position:[0,type==='glider'?.31:.43,type==='glider'?-.77:-.51],target:[0,type==='glider'?.27:.38,-length*6],fov:70,near:.025},
    nose:{position:[0,.12,-length*.5-.15],target:[0,.12,-length*6],fov:74,near:.025},
    leftWing:{position:[-span*.49,wingHeight,.05],target:[0,wingHeight-.08,-length*3.6],fov:76,near:.025},
    rightWing:{position:[span*.49,wingHeight,.05],target:[0,wingHeight-.08,-length*3.6],fov:76,near:.025},
    tail:{position:[0,.92,length*.59],target:[0,.16,-length*3],fov:72,near:.035},
    ...aircraft.userData.cameraMounts
  };
}

export class FlightCameraRig{
  constructor(camera){
    this.camera=camera;
    this.target=new THREE.Vector3();this.eye=new THREE.Vector3();
    this.aim=new THREE.Vector3();this.up=new THREE.Vector3();
    this.worldUp=new THREE.Vector3(0,1,0);this.heading=new THREE.Quaternion();
    this.controller=new THREE.Vector3(...CONTROLLER_POSITION);
    this.mountCache=new WeakMap();
    this.lastAircraft=null;this.lastMode=null;
  }

  restoreVisibility(){
    // Visibility belongs to a render pass, so leaving a view only resets its
    // camera tracking. No hidden airframe parts survive between renders.
    this.lastAircraft=null;this.lastMode=null;
  }

  render(renderer,scene){
    const hidden=[];
    try{
      if(this.lastMode==='cockpit')for(const part of this.lastAircraft?.userData.cockpitHide||[]){
        if(part){hidden.push([part,part.visible]);part.visible=false;}
      }
      return renderer.render(scene,this.camera);
    }finally{
      // Reverse order also preserves the original state if a model lists a
      // cockpit obstruction twice. The other camera always sees the full model.
      for(let i=hidden.length-1;i>=0;i--)hidden[i][0].visible=hidden[i][1];
    }
  }

  update(mode,aircraft,model,dt,{snap=false,zoom='auto',heightAt=()=>0}={}){
    if(!CAMERA_IDS.includes(mode))mode='ground';
    const changed=aircraft!==this.lastAircraft||mode!==this.lastMode;
    if(changed){
      this.lastAircraft=aircraft;this.lastMode=mode;
    }
    const instant=snap||changed||dt===0;
    const camera=this.camera,p=aircraft.position;
    const jetSpeed=model.config?.propulsion==='jet'?clamp((model.airspeed-model.config.takeoffSpeed)/Math.max(1,model.config.maxSpeed-model.config.takeoffSpeed),0,1):0;
    aircraft.updateMatrixWorld(true);
    if(mode==='ground'){
      camera.position.copy(this.controller);camera.up.copy(this.worldUp);
      this.target.lerp(p,instant?1:1-Math.exp(-dt*8));
      const distance=Math.max(1,this.controller.distanceTo(p));
      const fov=zoom==='wide'?60:clamp(58-10*Math.log2(Math.max(distance,45)/45),28,58);
      camera.fov=THREE.MathUtils.lerp(camera.fov,fov,instant?1:1-Math.exp(-dt*2.5));
      camera.near=.12;camera.lookAt(this.target);
      camera.rotateX(-THREE.MathUtils.degToRad(camera.fov*.08));
    }else if(mode==='chase'){
      const length=aircraft.userData.length||2.7,span=aircraft.userData.span||3.45;
      const distance=Math.max(length*2.5,span*1.6,7);
      this.heading.setFromAxisAngle(this.worldUp,-model.yaw);
      this.eye.set(0,distance*.31,distance).applyQuaternion(this.heading).add(p);
      this.eye.y=Math.max(heightAt(this.eye.x,this.eye.z)+1.1,this.eye.y);
      this.aim.set(0,.12,-length*.2).applyMatrix4(aircraft.matrixWorld);
      camera.position.lerp(this.eye,instant?1:1-Math.exp(-dt*7));
      camera.position.y=Math.max(heightAt(camera.position.x,camera.position.z)+.8,camera.position.y);
      this.target.lerp(this.aim,instant?1:1-Math.exp(-dt*9));
      camera.up.copy(this.worldUp);camera.fov=THREE.MathUtils.lerp(camera.fov,58+jetSpeed*6,instant?1:1-Math.exp(-dt*3));camera.near=.12;camera.lookAt(this.target);
    }else{
      let mounts=this.mountCache.get(aircraft);
      if(!mounts){mounts=getCameraMounts(aircraft);this.mountCache.set(aircraft,mounts);}
      const mount=mounts[mode];
      this.eye.fromArray(mount.position).applyMatrix4(aircraft.matrixWorld);
      this.aim.fromArray(mount.target).applyMatrix4(aircraft.matrixWorld);
      const lift=Math.max(0,heightAt(this.eye.x,this.eye.z)+.08-this.eye.y);
      this.eye.y+=lift;this.aim.y+=lift;
      camera.position.copy(this.eye);
      camera.up.copy(this.worldUp).transformDirection(aircraft.matrixWorld);
      camera.fov=THREE.MathUtils.lerp(camera.fov,(mount.fov||72)+jetSpeed*5,instant?1:1-Math.exp(-dt*3));camera.near=mount.near||.025;camera.lookAt(this.aim);
    }
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }
}

// A small, self-contained reflection map gives the silver airframe a sky and
// meadow to reflect. Three.js filters it for rough materials on first use.
export function createAirfieldEnvironment(){
  const width=256,height=128,pixels=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=1-y/(height-1),horizon=Math.exp(-Math.pow((v-.5)/.12,2));
    const sky=v<.5;
    const t=sky?v*2:(v-.5)*2;
    const a=sky?[111,157,187]:[164,169,132],b=sky?[225,231,214]:[83,108,75];
    const dx=Math.min(Math.abs(x/width-.18),1-Math.abs(x/width-.18));
    const sun=Math.exp(-(dx*dx/.003+Math.pow(v-.26,2)/.006));
    const i=(y*width+x)*4;
    for(let c=0;c<3;c++)pixels[i+c]=Math.min(255,a[c]+(b[c]-a[c])*t+horizon*6+sun*(c===2?44:78));
    pixels[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;texture.name='Skyfield sky and meadow reflections';
  return texture;
}
