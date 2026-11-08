/* GoLingo bridge — runs before the 3D game so WKWebView imports aren't lost. */
(function (host) {
  'use strict';
  if (host.SnowKingsBridge) return;
  const pending = [];
  const knownTypes = new Set(['golingoLesson','golingo:lesson','golingo:importWords','GoLingoData','GOLINGO_DATA','loadLesson','golingo:loadLesson']);
  const diagnostic = {ready:false,imports:0,queued:0,count:0,lastSource:null,lastError:null};
  let receiver=null,exporter=null,basketReader=null;

  function emit(type,extra={}) {
    const message={type,event:type,game:'snow-kings',version:1,...extra};
    try { host.webkit?.messageHandlers?.golingo?.postMessage(message); } catch (_) {}
    try { host.dispatchEvent(new CustomEvent(`golingo:${type}`,{detail:message})); } catch (_) {}
    return message;
  }
  function reportError(error,source) {
    diagnostic.lastError=String(error?.message||error);
    emit('error',{message:diagnostic.lastError,source});
    return {ok:false,error:diagnostic.lastError};
  }
  function load(payload,options={},source='native') {
    try {
      if (typeof payload==='string'&&payload.length>120000) throw Error('GoLingo lesson is too large.');
      if (payload==null) throw Error('Pass a nonempty GoLingo lesson.');
      if (!receiver) {
        if (pending.length>=12) throw Error('Too many pending lessons.');
        pending.push({payload,options,source});diagnostic.queued=pending.length;
        return {ok:true,queued:true};
      }
      const result=receiver(payload,options);
      diagnostic.imports++;
      diagnostic.count=result?.count||result?.total||0;
      diagnostic.lastSource=source;diagnostic.lastError=null;
      emit('wordsImported',{count:diagnostic.count,source});
      return {ok:true,...result};
    } catch (error) { return reportError(error,source); }
  }
  const bridge={
    version:1,emit,
    load(payload,options){return load(payload,options,'native');},
    connect(handlers){
      receiver=handlers.importLesson;exporter=handlers.exportWords;basketReader=handlers.getBasket;
      diagnostic.ready=true;
      const waiting=pending.splice(0);diagnostic.queued=0;
      waiting.forEach(item=>load(item.payload,item.options,item.source));
      emit('ready',{bridge:'GoLingoGame.importWords',game:'snow-kings'});
    },
    getImportDiagnostic(){return {...diagnostic,queued:pending.length};},
    getBasket(){return basketReader?basketReader():[];},
    exportWords(options){return exporter?exporter(options||{}):{ok:false,error:'Game is still loading.'};}
  };
  host.SnowKingsBridge=bridge;
  host.GoLingoGame=Object.assign(host.GoLingoGame||{}, {
    importWords:bridge.load,loadLesson:bridge.load,
    getImportDiagnostic:bridge.getImportDiagnostic,
    getBasket:bridge.getBasket,exportWords:bridge.exportWords
  });
  host.GoLingoBridge=Object.assign(host.GoLingoBridge||{}, {load:bridge.load,loadLesson:bridge.load,getBasket:bridge.getBasket});
  host.loadGoLingoData=bridge.load;
  host.receiveGoLingoData=bridge.load;
  host.golingoExport=bridge.exportWords;
  host.addEventListener('message',event=>{
    const direct=event.source===host||event.source===host.parent||event.source===host.opener;
    const sameOrigin=event.origin===host.location.origin||event.origin==='https://xcergolingo.github.io'||event.origin==='null'&&event.source===host;
    if(!direct||!sameOrigin||!event.data||typeof event.data!=='object')return;
    const data=event.data;if(!knownTypes.has(data.type||data.event))return;
    const payload=data.payload??data.lesson??data.data??data;
    load(payload,{append:data.append===true||data.options?.append===true},'postMessage');
  });
})(window);
