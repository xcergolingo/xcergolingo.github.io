/** Canonical GoLingo browser/native handoff; only explicitly trusted message senders. */
export function installGoLingoBridge({importWords,getLesson,getReview,exportReview,onError}={}) {
  const win=window;let active=false,disposed=false,readySent=false;
  function reportError(error){const message=error?.message||String(error);onError?.(new Error(message));sendEvent('error',{message});return {ok:false,error:message};}
  function sendEvent(name,metadata={}){
    if(disposed)return;
    const bare=String(name).replace(/^golingo:/,'');
    const detail={type:bare,event:bare,bridgeType:'golingo:'+bare,game:'roadster-rush'};
    for(const key of ['count','stageCount','lap','message','requestId'])if(metadata[key]!==undefined)detail[key]=metadata[key];
    try{win.webkit?.messageHandlers?.golingo?.postMessage(detail);}catch{}
    try{win.dispatchEvent(new CustomEvent('golingo:'+bare,{detail}));}catch{}
  }
  function checkPayload(payload){
    if(typeof payload==='string'){if(payload.length>100000)throw new Error('Keep lessons below 100,000 characters.');payload=JSON.parse(payload);}
    if(Array.isArray(payload))payload={words:payload};
    if(!payload||typeof payload!=='object')throw new Error('Pass a lesson object.');
    const content=payload.lesson||payload.payload||payload;
    const entries=content.words||content.sentences||content.vocabulary||content.items||content.entries||content.phrases;
    if(!Array.isArray(entries)||!entries.length)throw new Error('The lesson has no words or sentences.');
    if(entries.length>500)throw new Error('Use at most 500 source entries per lesson.');return payload;
  }
  function receive(payload,options={}){
    try{
      const result=importWords(checkPayload(payload),options);
      if(result?.then)return result.then(done,reportError);return done(result);
    }catch(error){return reportError(error);}
  }
  function done(result){if(result?.ok===false)return reportError(new Error(result.error||'Could not import the lesson.'));const lesson=getLesson();sendEvent('wordsImported',{count:result?.count??lesson?.words?.length??0,stageCount:result?.stageCount??lesson?.stages?.length??0});return result||{ok:true};}
  function setLanguages(value={}){
    const lesson=getLesson();if(!lesson)return {ok:false,error:'No lesson is loaded.'};
    const learningLanguage=value.learningLanguage||lesson.learningLanguage,primaryLanguage=value.primaryLanguage||value.translationLanguage||lesson.primaryLanguage;
    const relabel=row=>({...row,learningLanguage,primaryLanguage,translationLanguage:primaryLanguage});
    return receive({...lesson,learningLanguage,primaryLanguage,translationLanguage:primaryLanguage,words:lesson.words?.map(relabel),sentences:lesson.sentences?.map(row=>({...relabel(row),words:row.words?.map(relabel)}))});
  }
  const api={importWords:receive,load:receive,getLesson,getReview,exportToGoLingo:()=>exportReview(),setLanguages,reportError};
  function decode(value){
    const attempts=[value];try{const decoded=decodeURIComponent(value);if(decoded!==value)attempts.push(decoded);}catch{}
    for(const entry of attempts){try{return checkPayload(JSON.parse(entry));}catch{}try{const b64=entry.replace(/-/g,'+').replace(/_/g,'/');const binary=atob(b64);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return checkPayload(JSON.parse(new TextDecoder().decode(bytes)));}catch{}}
    return null;
  }
  let initialPayload=null;
  try{
    const hash=new URLSearchParams(win.location.hash.replace(/^#/,'')),query=new URLSearchParams(win.location.search);
    const value=hash.get('golingoLesson')||query.get('lesson')||query.get('data')||query.get('golingoLesson');
    if(value&&value.length<=100000)initialPayload=decode(value);
    if(!initialPayload){const stored=win.sessionStorage?.getItem('golingo:active-lesson:v1');if(stored&&stored.length<=100000)initialPayload=decode(stored);}
  }catch{}
  const allowed=new Set(['https://golingoapp.com','https://www.golingoapp.com','https://xcergolingo.github.io']);
  try{if(/^https?:\/\//.test(win.location.origin))allowed.add(win.location.origin);}catch{}
  for(const entry of Array.isArray(win.GoLingoAllowedOrigins)?win.GoLingoAllowedOrigins:[]){try{const url=new URL(entry);if(['https:','http:'].includes(url.protocol))allowed.add(url.origin);}catch{}}
  const accepted=new Set(['golingo:importWords','golingo:loadLesson','golingo:lesson','GOLINGO_LESSON']);
  function message(event){
    if(!active||disposed||!allowed.has(event.origin)||![win,win.parent,win.opener].includes(event.source))return;
    const data=event.data;if(!data||typeof data!=='object'||!accepted.has(data.type))return;
    const result=receive(data.payload||data.lesson||data.data||(data.words?data:null),data.options||{});
    Promise.resolve(result).then(value=>{try{event.source.postMessage({type:'golingo:importResult',game:'roadster-rush',requestId:data.requestId,...value},event.origin);}catch{}});
  }
  win.addEventListener('message',message);
  function customImport(event){if(active&&!disposed)receive(event.detail?.payload||event.detail,event.detail?.options||{});}
  win.addEventListener('golingo:importWords',customImport);
  return {initialPayload,sendEvent,
    activate(){
      if(active||disposed)return;active=true;
      win.GoLingoGame={importWords:receive,load:receive,getLesson,getReview,exportToGoLingo:api.exportToGoLingo};
      win.RoadsterRushLanguage={load:receive,importWords:receive,setLanguages,getLesson,getReview};
      if(!readySent){readySent=true;sendEvent('ready');}
      win.RoadsterEarlyBridge?.attach(api);
    },
    dispose(){disposed=true;active=false;win.removeEventListener('message',message);win.removeEventListener('golingo:importWords',customImport);}
  };
}
