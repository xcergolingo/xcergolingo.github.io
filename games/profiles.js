'use strict';
// GoLingo public aliases & referral visit telemetry (no emails published).
// Every number here is recorded activity; it is not proof of learning,
// unique visitors, or qualified prize entries.
(async()=>{
 const $=id=>document.getElementById(id);
 const form=$('challenge-profile-form');
 const name=$('challenge-profile-name');
 const publicToggle=$('challenge-profile-public');
 const info=$('challenge-profile-info');
 const guest=$('challenge-profile-guest');
 const connect=$('challenge-profile-connect');
 const connection=$('challenge-profile-connection');
 const help=$('challenge-profile-help');
 const personal=$('challenge-my-link');
 const personalLink=$('challenge-referral-link');
 const visits=$('challenge-link-visits');
 const copy=$('challenge-copy-referral');
 const table=$('challenge-leaderboard-body');
 const refresh=$('challenge-refresh-leaderboard');
 if(!form||!name||!table)return;
 let authed=null,anon=null,profile=null,owner=null,loading=false;
 const current=()=>window.GoLingoCognito?.getUser?.()?.id||null;
 const validUuid=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
 function linkForOwner(url){
   if(!profile?.public_id||!current())return url;
   try{
     const out=new URL(url,location.href);
     if(out.protocol!=='https:'||out.hostname!=='xcergolingo.github.io')return url;
     out.searchParams.set('ref',profile.public_id);
     return out.href;
   }catch{return url}
 }
 window.GoLingoProfiles={decorateUrl:linkForOwner,currentId:()=>profile?.public_id||null,refresh:()=>refreshProfile()};
 const getClient=()=>{
   if(!window.supabase?.createClient)return null;
   return window.supabase;
 };
 async function initialize(){
   try{
     const config=await fetch('cloud-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Cloud settings unavailable');return r.json()});
     for(let n=0;n<70&&!getClient();n++)await new Promise(resolve=>setTimeout(resolve,120));
     if(!getClient())throw Error('Supabase library not ready');
     anon=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
     authed=window.supabase.createClient(config.url,config.anonKey,{
       accessToken:async()=>window.GoLingoCognito?.getToken?.()||null,
       auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
     });
     await Promise.all([refreshLeaderboard(),recordIncomingVisit(),refreshProfile()]);
   }catch(error){
     table.replaceChildren();
     const tr=document.createElement('tr'),td=document.createElement('td');
     td.colSpan=5;td.textContent='Leaderboard unavailable until cloud setup is complete.';
     tr.append(td);table.append(tr);
   }
 }
 async function recordIncomingVisit(){
   const id=new URLSearchParams(location.search).get('ref');
   if(!validUuid(id)||!anon)return;
   // Avoid repeated counted visits caused by reloads in this browser.
   const key='golingo:referral:'+id.toLowerCase();
   try{
     const last=Number(sessionStorage.getItem(key)||0);
     if(Date.now()-last<60000)return;
   }catch{}
   try{
     const {error}=await anon.rpc('golingo_record_game_referral_visit',{p_public_id:id});
     if(error)return;
     try{sessionStorage.setItem(key,String(Date.now()))}catch{}
   }catch{}
 }
 function showConnectionStatus(requesting=false){
   if(!connection)return;
   const bridge=window.GoLingoCognito;
   const infoState=bridge?.authStatus?.()||null;
   const available=!!bridge?.nativeAvailable?.();
   if(connect)connect.hidden=!available;
   if(!available){
     connection.textContent='Your GoLingo Apple sign-in is not reaching Online Games. This page has no app authentication bridge.';
     if(help)help.textContent='Open Online Games from the latest GoLingo app. If it still shows this message, the iOS/iPadOS app needs its GoLingo authentication bridge enabled. No new Apple ID or account is required.';
   }else if(infoState?.reason==='missing-role'){
     connection.textContent='GoLingo account detected, but its game access token is missing the authenticated role claim.';
     if(help)help.textContent='Sign out and sign back in inside GoLingo, then tap Connect. If it continues, the app developer must update the Cognito token claims.';
   }else if(infoState?.reason==='wrong-token'){
     connection.textContent='GoLingo sent a token, but Online Games could not validate it for this account.';
     if(help)help.textContent='Open GoLingo, sign in again with Apple, and tap Connect. Do not share tokens or passwords.';
   }else{
     connection.textContent=requesting?'Requesting your existing GoLingo login from the app…':'Your Apple sign-in has not yet connected to Online Games.';
     if(help)help.textContent='If you already signed in with Apple, tap Connect my GoLingo account. You do not need to create another account.';
   }
 }
 function setSignedOut(){
   owner=null;profile=null;
   form.hidden=true;guest.hidden=false;personal.hidden=true;
   info.textContent='Save your profile after connecting your GoLingo account.';
   showConnectionStatus();
 }
 connect?.addEventListener('click',()=>{
   const bridge=window.GoLingoCognito;
   if(bridge?.nativeAvailable?.()&&bridge.requestNativeToken()){
     showConnectionStatus(true);
   }else showConnectionStatus();
 });
 async function refreshProfile(){
   if(!authed)return;
   const id=current();
   if(!id){setSignedOut();return}
   if(loading)return;
   loading=true;
   try{
     const {data,error}=await authed.rpc('golingo_get_my_game_profile');
     if(error)throw error;
     if(id!==current())return;
     owner=id;
     const p=Array.isArray(data)?data[0]:data;
     profile=p||null;
     form.hidden=false;guest.hidden=true;
     if(p){
       name.value=p.display_name;
       publicToggle.checked=!!p.leaderboard_visible;
       personal.hidden=false;
       personalLink.value=linkForOwner('https://xcergolingo.github.io/games/');
       visits.textContent=(Number(p.link_visits)||0).toLocaleString();
       info.textContent='Profile saved. Your email remains private. '+(p.leaderboard_visible?'You appear on the public leaderboard when you have a recorded streak.':'Your leaderboard participation is off.');
     }else {
       personal.hidden=true;
       info.textContent='Choose a unique public name. Leaderboard participation is optional.';
     }
   }catch(error){
     if(id===current()){
       form.hidden=false;guest.hidden=true;personal.hidden=true;
       info.textContent='Profile setup is not ready. Run game-profiles-leaderboard.sql in Supabase.';
     }
   }finally{loading=false}
 }
 form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(!authed||!current())return;
   const value=name.value.trim();
   if(!/^[A-Za-z][A-Za-z0-9_]{2,23}$/.test(value)){
     info.textContent='Use 3–24 letters, numbers or underscores, starting with a letter.';return
   }
   info.textContent='Saving your public profile…';
   const id=current();
   try{
     const {data,error}=await authed.rpc('golingo_save_game_profile',{p_name:value,p_visible:publicToggle.checked});
     if(error)throw error;
     if(id!==current())return;
     profile=Array.isArray(data)?data[0]:data;
     owner=id;
     personal.hidden=false;
     personalLink.value=linkForOwner('https://xcergolingo.github.io/games/');
     visits.textContent=(Number(profile?.link_visits)||0).toLocaleString();
     info.textContent='Profile saved. Your email is private; only your chosen name and public statistics appear if you opted in.';
     refreshLeaderboard();
   }catch(error){
     info.textContent=/duplicate key|unique/i.test(String(error?.message))?
       'This online name is already taken. Please choose another.':
       'Could not save your profile: '+String(error?.message||error);
   }
 });
 copy.addEventListener('click',async()=>{
   if(!profile)return;
   const url=linkForOwner('https://xcergolingo.github.io/games/');
   try{
     await navigator.clipboard.writeText(url);
     info.textContent='Personal GoLingo Games link copied. Visits are recorded when people open it.';
     window.GoLingoStreak?.recordShare?.('gallery','copy');
   }catch{
     personalLink.focus();personalLink.select();
     info.textContent='Select and copy your personal link to share.';
   }
 });
 async function refreshLeaderboard(){
   if(!anon)return;
   refresh.disabled=true;
   try{
     const {data,error}=await anon.rpc('golingo_game_top_streaks');
     if(error)throw error;
     table.replaceChildren();
     const rows=Array.isArray(data)?data:[];
     if(!rows.length){
       const tr=document.createElement('tr'),td=document.createElement('td');
       td.colSpan=5;td.textContent='No public players yet. Save your profile and opt in to join the leaderboard.';
       tr.append(td);table.append(tr);
     }
     rows.slice(0,10).forEach((item,index)=>{
       const tr=document.createElement('tr');
       const values=[
         String(index+1),
         String(item.display_name||'Player')+(item.medal?' · '+({Silver:'🥈',Gold:'🥇',Diamond:'💎'}[item.medal]||''):''),
         String(Number(item.current_days)||0),
         String(Number(item.games_tried)||0),
         String(Number(item.published_sentences)||0)
       ];
       for(const value of values){
         const td=document.createElement('td');td.textContent=value;tr.append(td);
       }
       table.append(tr);
     });
   }catch{
     table.replaceChildren();
     const tr=document.createElement('tr'),td=document.createElement('td');
     td.colSpan=5;td.textContent='Leaderboard is awaiting the new Supabase SQL setup.';
     tr.append(td);table.append(tr);
   }finally{refresh.disabled=false}
 }
 refresh.addEventListener('click',refreshLeaderboard);
 window.addEventListener('golingo:auth-state',()=>{if(authed)refreshProfile();else showConnectionStatus()});
 window.addEventListener('golingo:cognito-auth-status',()=>{if(!current())showConnectionStatus()});
 window.addEventListener('golingo:community-changed',()=>{if(anon)refreshLeaderboard()});
 document.addEventListener('visibilitychange',()=>{
   if(!document.hidden&&authed){refreshProfile();refreshLeaderboard()}
 });
 let lastId=null;
 setInterval(()=>{
   const now=current();
   if(now!==lastId){
     lastId=now;
     if(authed)refreshProfile();
     else if(!now)setSignedOut();
   }
 },2800);
 setSignedOut();
 await initialize();
})();
