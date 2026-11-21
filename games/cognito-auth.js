'use strict';
// Native GoLingo iOS WKWebView Cognito authentication only.
// Browser PKCE, Hosted UI redirects and cached browser sessions are disabled.
// Server-side prize eligibility still needs trusted app attestation and review.
(() => {
  const legacyToken='golingo:cognito:id-token:v1';
  const legacyPkce='golingo:cognito:pkce:v1';
  const issuer='https://cognito-idp.us-east-1.amazonaws.com/us-east-1_m1wn7aFbx';
  const appStore='https://apps.apple.com/us/app/learn-lingo-with-golingo-ai/id1194977025';
  let token=null,source=null,onChange=()=>{},lastReason='not-connected';
  function emitStatus(){
    window.dispatchEvent(new CustomEvent('golingo:cognito-auth-status',{detail:{reason:lastReason}}));
  }
  const authStatus=()=>({connected:!!getUser(),reason:lastReason,bridgeAvailable:nativeAvailable()});
  const nativeAvailable=()=>!!window.webkit?.messageHandlers?.goLingoAuth?.postMessage;
  function decode(value){
    try{return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}
    catch{return null}
  }
  function getUser(){
    if(source!=='native'||!nativeAvailable())return null;
    const p=token&&decode(token);
    return p&&p.iss===issuer&&p.token_use==='id'&&p.role==='authenticated'&&
      typeof p.sub==='string'&&p.exp*1000>Date.now()+30000?
      {id:p.sub,email:p.email||null}:null;
  }
  function requestNativeToken(){
    if(!nativeAvailable()){lastReason='no-bridge';emitStatus();return false}
    lastReason='waiting-for-token';emitStatus();
    try{
      window.webkit.messageHandlers.goLingoAuth.postMessage({type:'requestCognitoIdToken'});
      return true;
    }catch{lastReason='bridge-error';emitStatus();return false}
  }
  function getToken(){
    if(getUser())return token;
    if(token){token=null;source=null;onChange(null);requestNativeToken()}
    return null;
  }
  function receiveNativeToken(jwt){
    // This callback is intended for the trusted in-app bridge, not a web login.
    if(!nativeAvailable()||typeof jwt!=='string')return false;
    const previous=token,previousSource=source;
    token=jwt;source='native';
    if(!getUser()){
      const payload=decode(jwt);
      lastReason=payload?.role!=='authenticated'&&payload?.token_use==='id'?'missing-role':'wrong-token';
      token=previous;source=previousSource;
      emitStatus();
      return false;
    }
    lastReason='connected';
    onChange(getUser());
    emitStatus();
    return true;
  }
  function nativeSessionUnavailable(reason){
    if(!nativeAvailable())return;
    token=null;source=null;lastReason='app-session-unavailable';onChange(null);emitStatus();
    const element=document.getElementById('cloud-status');
    if(element)element.textContent='GoLingo app login required: '+String(reason||'Sign in to your GoLingo account in the app.');
  }
  function signIn(){
    if(nativeAvailable()){
      requestNativeToken();
      return Promise.resolve();
    }
    // Never open a browser OAuth / email sign-in page.
    return Promise.reject(Error('Open GoLingo app to sign in for cloud progress and the 365-day challenge. Download: '+appStore));
  }
  function initialize(_config,change){
    onChange=change;
    // Old browser sessions must not automatically sign in after this update.
    try{sessionStorage.removeItem(legacyToken);sessionStorage.removeItem(legacyPkce)}catch{}
    // A native reply can arrive before cloud.js initializes. Preserve an
    // already accepted native token rather than wiping the app session.
    if(!getUser()){token=null;source=null}
    onChange(getUser());
    if(nativeAvailable()&&!getUser())requestNativeToken();
    return Promise.resolve();
  }
  function signOut(){
    token=null;source=null;lastReason='signed-out';onChange(null);emitStatus();
  }
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&nativeAvailable())requestNativeToken();
  });
  window.GoLingoCognito={initialize,signIn,signOut,getToken,getUser,
    receiveNativeToken,requestNativeToken,nativeSessionUnavailable,
    nativeAvailable,authStatus,hasBrowserLogin:()=>false};
})();
