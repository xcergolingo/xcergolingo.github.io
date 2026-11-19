'use strict';
// Safe, opt-in Cognito/Supabase auth diagnostic. No JWT or email is printed.
(async () => {
  const marker='golingo:cognito:diagnostic-active:v1';
  const params=new URLSearchParams(location.search);
  if(params.get('checkCognito')==='1'){
    try {sessionStorage.setItem(marker,'1');}catch {}
    history.replaceState(null,'',location.pathname+'#games');
  }
  let active=false;
  try {active=sessionStorage.getItem(marker)==='1'}catch {}
  if(!active)return;
  const parent=document.getElementById('golingo-cloud');
  if(!parent)return;
  const box=document.createElement('section');
  box.className='golingo-diagnostic';
  const title=document.createElement('h4');title.textContent='Cognito & Supabase connection test';
  const message=document.createElement('p');message.setAttribute('role','status');
  message.textContent='Ready to test. No passwords or tokens are displayed.';
  const go=document.createElement('button');go.className='hub-chip';go.type='button';go.textContent='Sign in and check connection';
  const close=document.createElement('button');close.className='hub-chip';close.type='button';close.textContent='Close test';
  box.append(title,message,go,close);
  parent.prepend(box);
  const stop=()=>{try{sessionStorage.removeItem(marker)}catch{} window.GoLingoCognito?.signOut();box.remove()};
  close.addEventListener('click',stop);
  function outcome(label,pass,detail){
    const line=document.createElement('p');
    line.textContent=(pass?'PASS: ':'FAIL: ')+label+(detail?' — '+detail:'');
    line.className=pass?'diagnostic-pass':'diagnostic-fail';
    box.append(line);
  }
  try{
    const res=await fetch('cloud-config.json',{cache:'no-store'});
    if(!res.ok)throw Error('Configuration unavailable');
    const config=await res.json();
    if(!config.cognito?.webClientId || !config.cognito?.hostedUiDomain)throw Error('Cognito login is not configured');
    await window.GoLingoCognito.initialize({...config,cognito:{...config.cognito,enabled:true}},()=>{});
    const user=window.GoLingoCognito.getUser();
    if(user){
      go.hidden=true;
      const jwt=window.GoLingoCognito.getToken();
      const payload=JSON.parse(atob(jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const roleOk=payload.role==='authenticated';
      outcome('Cognito ID token is current and from the configured pool',true);
      outcome('Cognito role claim',roleOk,roleOk?'authenticated':'Missing authenticated role — inspect AWS Lambda trigger');
      if(roleOk){
        const library=document.createElement('script');
        library.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        await new Promise((resolve,reject)=>{library.onload=resolve;library.onerror=()=>reject(Error('Supabase library failed to load'));document.head.append(library)});
        const client=window.supabase.createClient(config.url,config.anonKey,{
          accessToken:async()=>jwt,auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
        });
        const {error}=await client.from('golingo_game_lessons').select('id').limit(1);
        outcome('Supabase authenticated database query',!error,
          error?'Database access rejected; check Cognito provider and RLS migration':'Database request accepted');
      }else{outcome('Supabase check skipped because required role is absent',false)}
      message.textContent='Test finished. Close test when done. Do not share JWTs or passwords.';
    }else{
      message.textContent='Click the button to use your existing GoLingo Cognito email/password login. You will return here automatically.';
    }
    go.addEventListener('click',async()=>{
      try{message.textContent='Opening Cognito sign-in…';await window.GoLingoCognito.signIn()}
      catch(error){message.textContent='Cannot start test: '+error.message}
    });
  }catch(error){message.textContent='Test could not complete: '+error.message}
})();
