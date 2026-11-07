import {PointerLockControls} from './vendor/PointerLockControls.js';

export function createInput(camera,canvas,callbacks,mobile){
 const control=new PointerLockControls(camera,canvas);control.minPolarAngle=.18;control.maxPolarAngle=Math.PI-.18;
 const keys=new Set(),actionResets=[];let sensitivity=1,active=false,dragId=null,lookId=null,moveId=null,lastX=0,lastY=0,lookX=0,lookY=0,moveX=0,moveY=0,fireHeld=false,hadLock=false;
 const $=id=>document.getElementById(id),thumb=$('stickThumb'),pad=$('movePad');
 function look(dx,dy){camera.rotation.order='YXZ';camera.rotation.y-=dx*.0026*sensitivity;camera.rotation.x=Math.max(-1.38,Math.min(1.38,camera.rotation.x-dy*.0026*sensitivity));camera.rotation.z=0;}
 function release(){keys.clear();fireHeld=false;dragId=lookId=moveId=null;moveX=moveY=0;thumb.style.transform='';for(const reset of actionResets)reset();document.querySelectorAll('.action.pressed').forEach(x=>x.classList.remove('pressed'));}
 control.addEventListener('lock',()=>{hadLock=true;});
 control.addEventListener('unlock',()=>{if(active&&hadLock){hadLock=false;callbacks.pause();}});
 control.addEventListener('lockerror',()=>{if(active)callbacks.notice('DRAG TO AIM · CLICK TO FIRE');});
 document.addEventListener('pointerlockerror',()=>{if(active)callbacks.notice('DRAG TO AIM · CLICK TO FIRE');});
 document.addEventListener('keydown',e=>{
  if(!active)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')callbacks.jump();
  if(e.code==='ShiftLeft'||e.code==='ShiftRight')callbacks.dash();
  if(e.code==='KeyR')callbacks.reload();
  if(e.code==='KeyH')callbacks.hunt?.();
  if(e.code==='KeyL')callbacks.listen?.();
  if(e.code==='KeyB')callbacks.basket?.();
  if(e.code==='KeyF'||e.code==='KeyE')callbacks.punch();
  if(e.code==='Escape'||e.code==='KeyP')callbacks.pause();
 });
 document.addEventListener('keyup',e=>keys.delete(e.code));
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{if(!active||mobile)return;e.preventDefault();if(e.button===0){fireHeld=true;callbacks.fire();}if(!control.isLocked){dragId=e.pointerId;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);}});
 window.addEventListener('pointermove',e=>{if(!active||mobile||control.isLocked||dragId!==e.pointerId)return;look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;});
 window.addEventListener('pointerup',e=>{if(!mobile)fireHeld=false;if(dragId===e.pointerId)dragId=null;});
 window.addEventListener('pointercancel',e=>{if(!mobile)fireHeld=false;if(dragId===e.pointerId)dragId=null;});
 canvas.addEventListener('lostpointercapture',e=>{if(!mobile)fireHeld=false;if(dragId===e.pointerId)dragId=null;});
 window.addEventListener('blur',()=>{release();if(active)callbacks.pause();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(active)callbacks.pause();}});
 pad.addEventListener('pointerdown',e=>{if(!active||moveId!==null)return;e.preventDefault();e.stopPropagation();moveId=e.pointerId;pad.setPointerCapture(e.pointerId);updateStick(e);});
 function updateStick(e){const b=pad.getBoundingClientRect(),r=b.width*.37;let dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2;const d=Math.hypot(dx,dy);if(d>r){dx*=r/d;dy*=r/d;}moveX=dx/r;moveY=dy/r;thumb.style.transform=`translate(${dx}px,${dy}px)`;}
 pad.addEventListener('pointermove',e=>{if(e.pointerId===moveId){e.preventDefault();updateStick(e);}});
 const releaseStick=e=>{if(e.pointerId===moveId){moveId=null;moveX=moveY=0;thumb.style.transform='';}};
 pad.addEventListener('pointerup',releaseStick);pad.addEventListener('pointercancel',releaseStick);pad.addEventListener('lostpointercapture',releaseStick);
 const zone=$('lookZone');zone.addEventListener('pointerdown',e=>{if(!active||lookId!==null)return;e.preventDefault();e.stopPropagation();lookId=e.pointerId;lookX=e.clientX;lookY=e.clientY;zone.setPointerCapture(e.pointerId);});
 zone.addEventListener('pointermove',e=>{if(e.pointerId===lookId){e.preventDefault();look(e.clientX-lookX,e.clientY-lookY);lookX=e.clientX;lookY=e.clientY;}});
 const releaseLook=e=>{if(e.pointerId===lookId)lookId=null;};zone.addEventListener('pointerup',releaseLook);zone.addEventListener('pointercancel',releaseLook);zone.addEventListener('lostpointercapture',releaseLook);
 const action=(id,fn,held=false)=>{const el=$(id);let pointer=null;actionResets.push(()=>{const old=pointer;pointer=null;if(old!==null&&el.hasPointerCapture?.(old))el.releasePointerCapture(old);el.classList.remove('pressed');});el.addEventListener('pointerdown',e=>{if(!active||pointer!==null)return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;el.setPointerCapture(e.pointerId);el.classList.add('pressed');if(held)fireHeld=true;fn();});const up=e=>{if(pointer===e.pointerId){pointer=null;el.classList.remove('pressed');if(held)fireHeld=false;}};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);};
 action('fireBtn',callbacks.fire,true);action('jumpBtn',callbacks.jump);action('dashBtn',callbacks.dash);action('punchBtn',callbacks.punch);action('reloadBtn',callbacks.reload);
 return {control,get locked(){return control.isLocked;},get firing(){return fireHeld;},setSensitivity(v){sensitivity=v;control.pointerSpeed=v;},getMovement(){let x=moveX+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),z=moveY+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const d=Math.hypot(x,z);if(d>1){x/=d;z/=d;}return {x,z};},activate(){active=true;},requestLock(){if(mobile)return;try{const pending=control.lock();if(pending?.catch)pending.catch(()=>{if(active)callbacks.notice('DRAG TO AIM · CLICK TO FIRE');});}catch{callbacks.notice('DRAG TO AIM · CLICK TO FIRE');}},deactivate(){active=false;hadLock=false;release();if(control.isLocked)control.unlock();},clear:release};
}
