// Deliberately separate from the game bundle, so parse errors can be reported.
(function(){'use strict';
  var root=document.getElementById('boot-status'),state='loading',phase='Opening the game',errorText='',lastProgress=Date.now(),started=Date.now(),slow=false,low=false;
  if(!root)return;
  function node(id){return document.getElementById(id);}
  function text(id,value){node(id).textContent=value;}
  try{low=new URL(location.href).searchParams.get('graphics')==='low';}catch(_){}
  function actions(show){node('boot-actions').hidden=!show;node('boot-low').hidden=low;}
  function cleanup(){clearInterval(timer);window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onReject);document.removeEventListener('securitypolicyviolation',onPolicy);}
  function fail(error,kind){if(state!=='loading')return;state='failed';errorText=String(error&&error.message||error||'Startup did not finish.');cleanup();root.hidden=false;root.classList.remove('hidden');text('boot-title','The game could not start');text('boot-detail',kind==='blocked'?'This viewer is blocking interactive play. Open the game as a web page in a browser.':'Try again or try lighter graphics. Your saved lesson and review basket are kept.');text('boot-error',errorText.slice(0,1200));node('boot-diagnostics').hidden=false;actions(true);if(kind==='blocked'||kind==='script')node('boot-low').hidden=true;}
  function onError(event){if(event.message||event.error)fail(event.error||new Error(event.message),phase==='Opening the game'?'script':'runtime');}
  function onReject(event){fail(event.reason);}
  function onPolicy(event){if(String(event.effectiveDirective||'').indexOf('script-src')===0)fail(new Error('The viewer blocked the game script.'),'blocked');}
  function checkpoint(value){if(state!=='loading')return;phase=value;lastProgress=Date.now();slow=false;text('boot-title','Preparing your Roadster…');text('boot-detail','Your drive is almost ready.');text('boot-phase',phase);actions(false);}
  function next(value){checkpoint(value);return new Promise(function(resolve,reject){setTimeout(function(){if(state==='failed')reject(new Error(errorText));else resolve();},20);});}
  function retry(lighter){try{var url=new URL(location.href);if(lighter)url.searchParams.set('graphics','low');if(url.href===location.href)location.reload();else location.assign(url.href);}catch(_){location.reload();}}
  node('boot-retry').onclick=function(){retry(false);};node('boot-low').onclick=function(){retry(true);};
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onReject);document.addEventListener('securitypolicyviolation',onPolicy);
  window.RoadsterBoot={lowGraphics:low,next:next,checkpoint:checkpoint,fail:fail,ready:function(){if(state!=='loading')return;state='ready';cleanup();root.hidden=true;root.classList.add('hidden');},getState:function(){return {status:state,phase:phase,elapsedMs:Date.now()-started,lowGraphics:low};}};
  checkpoint(phase);
  var timer=setInterval(function(){if(state!=='loading'||slow||Date.now()-lastProgress<12000)return;slow=true;text('boot-title','This is taking longer than usual');text('boot-detail',low?'You can wait a little longer or try again.':'You can wait, try again, or try lighter graphics.');actions(true);},1000);
})();
