'use strict';
// Browser authorization-code + PKCE, or native WKWebView Cognito ID token.
// Short-lived tokens only; never passwords, Apple tokens or refresh tokens.
(() => {
  const sessionKey='golingo:cognito:id-token:v1',pendingKey='golingo:cognito:pkce:v1';
  const issuer='https://cognito-idp.us-east-1.amazonaws.com/us-east-1_m1wn7aFbx';
  let config={},token=null,onChange=()=>{},nativeAsked=false;
  const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  function decode(value){try{return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}}
  function getUser(){
    const p=token&&decode(token);
    return p&&p.iss===issuer&&p.token_use==='id'&&typeof p.sub==='string'&&
      p.exp*1000>Date.now()+30000?{id:p.sub,email:p.email||null}:null;
  }
  function getToken(){return getUser()?token:null}
  function receiveNativeToken(jwt){
    if(typeof jwt!=='string')return false;
    const old=token;token=jwt;
    if(!getUser()){token=old;return false}
    onChange(getUser());return true;
  }
  function nativeAvailable(){return !!window.webkit?.messageHandlers?.goLingoAuth?.postMessage}
  function requestNativeToken(){
    if(!nativeAvailable())return;
    window.webkit.messageHandlers.goLingoAuth.postMessage({type:'requestCognitoIdToken'});
  }
  function domain(){
    if(!config.enabled||!config.hostedUiDomain||!config.webClientId)return null;
    try{const url=new URL(config.hostedUiDomain);
      if(url.protocol==='https:'&&url.pathname==='/'&&!url.search&&!url.hash&&!url.username)return url.origin;
    }catch{}return null;
  }
  async function signIn(){
    const origin=domain();
    if(!origin)throw Error('Cognito browser sign-in needs a Hosted UI domain and public OAuth app client.');
    const verifier=b64(crypto.getRandomValues(new Uint8Array(32)));
    const state=b64(crypto.getRandomValues(new Uint8Array(24)));
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    sessionStorage.setItem(pendingKey,JSON.stringify({verifier,state,time:Date.now()}));
    const url=new URL(origin+'/oauth2/authorize');
    url.search=new URLSearchParams({response_type:'code',client_id:config.webClientId,
      redirect_uri:location.origin+'/games/',scope:'openid email',
      state,code_challenge:b64(digest),code_challenge_method:'S256'}).toString();
    location.assign(url.href);
  }
  async function callback(){
    const p=new URLSearchParams(location.search);
    if(!p.has('code')&&!p.has('error'))return;
    const code=p.get('code'),state=p.get('state'),error=p.get('error');
    history.replaceState(null,'',location.pathname+location.hash);
    if(error)throw Error('Cognito login failed: '+error);
    const raw=sessionStorage.getItem(pendingKey);
    sessionStorage.removeItem(pendingKey);
    let pending;try{pending=JSON.parse(raw)}catch{}
    if(!pending||!state||state!==pending.state||Date.now()-pending.time>600000)throw Error('Cognito login state expired or invalid.');
    const origin=domain();if(!origin)throw Error('Cognito browser login not configured.');
    const body=new URLSearchParams({grant_type:'authorization_code',client_id:config.webClientId,
      code,redirect_uri:location.origin+'/games/',code_verifier:pending.verifier});
    const response=await fetch(origin+'/oauth2/token',{method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    if(!response.ok)throw Error('Cognito token exchange failed: '+response.status);
    const values=await response.json();
    if(!receiveNativeToken(values.id_token))throw Error('Cognito did not return a valid ID token.');
    sessionStorage.setItem(sessionKey,values.id_token);
  }
  async function initialize(all,change){
    config=all.cognito||{};onChange=change;
    const stored=sessionStorage.getItem(sessionKey);
    if(stored)receiveNativeToken(stored);
    await callback();
    if(nativeAvailable()&&!nativeAsked){nativeAsked=true;requestNativeToken()}
    onChange(getUser());
  }
  function signOut(){
    token=null;sessionStorage.removeItem(sessionKey);
    onChange(null);
  }
  window.GoLingoCognito={initialize,signIn,signOut,getToken,getUser,receiveNativeToken,
    requestNativeToken,nativeAvailable,hasBrowserLogin:()=>!!domain()};
})();
