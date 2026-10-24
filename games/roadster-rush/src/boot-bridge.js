/* Install before async 3D startup: WKWebView didFinish may inject a lesson early. */
(function(){
  'use strict';
  var pending=[],delegate=null;
  function call(name,args,fallback){if(delegate&&typeof delegate[name]==='function')return delegate[name].apply(delegate,args);if(name==='importWords'||name==='setLanguages'){pending.push({name:name,args:Array.prototype.slice.call(args)});return {ok:true,queued:true};}return fallback;}
  var api={importWords:function(){return call('importWords',arguments,{ok:false});},load:function(){return call('importWords',arguments,{ok:false});},getLesson:function(){return call('getLesson',arguments,null);},getReview:function(){return call('getReview',arguments,[]);},exportToGoLingo:function(){return call('exportToGoLingo',arguments,{ok:false,error:'The game is still opening.'});}};
  var languageAPI={load:api.load,importWords:api.importWords,getLesson:api.getLesson,getReview:api.getReview,setLanguages:function(){return call('setLanguages',arguments,{ok:false});}};
  window.GoLingoGame=api;window.RoadsterRushLanguage=languageAPI;
  window.RoadsterEarlyBridge={attach:function(real){delegate=real;var queue=pending.splice(0);queue.forEach(function(item){try{real[item.name].apply(real,item.args);}catch(e){if(real.reportError)real.reportError(e);}});},pendingCount:function(){return pending.length;}};
})();
