/* A control activates on a deliberate tap, never at the end of a swipe.
   Pointer-up keeps pronunciation recovery inside a real mobile user gesture. */
export function bindGameTap(button,action,{canTap=()=>true,onGesture=()=>{}}={}){
 let press=null;
 button.addEventListener('pointerdown',e=>{
  if(press||e.isPrimary===false||(e.button!=null&&e.button!==0)||!canTap())return;
  press={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
  try{button.setPointerCapture(e.pointerId);}catch{}
 });
 button.addEventListener('pointermove',e=>{
  if(press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>10)press.moved=true;
 });
 button.addEventListener('pointerup',e=>{
  if(press?.id!==e.pointerId)return;
  const p=press;press=null;e.preventDefault();
  if(!p.moved&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=10&&canTap()){action(e);onGesture();}
 });
 const cancel=e=>{if(press?.id===e.pointerId)press=null;};
 button.addEventListener('pointercancel',cancel);button.addEventListener('lostpointercapture',cancel);
 button.addEventListener('click',e=>{
  // Pointer activation was handled above. Keep keyboard/screen-reader clicks.
  if(e.detail>0||e.pointerType){e.preventDefault();return;}
  if(canTap()){action(e);onGesture();}
 });
}

export function bindRunLifecycle({windowTarget=globalThis,documentTarget=globalThis.document,isPlaying,clearInput,suspendSpeech,resumeSpeech,recoverSpeech}){
 let backgrounded=false;
 // iOS notifications and browser chrome can blur a visible page. That must
 // release held controls without opening a menu or stopping the current word.
 windowTarget.addEventListener('blur',clearInput);
 windowTarget.addEventListener('focus',()=>{if(!documentTarget.hidden&&isPlaying())recoverSpeech();});
 documentTarget.addEventListener('visibilitychange',()=>{
  if(documentTarget.hidden){
   clearInput();if(isPlaying()&&!backgrounded){backgrounded=true;suspendSpeech();}
  }else if(backgrounded){
   backgrounded=false;if(isPlaying())resumeSpeech();
  }
 });
}
