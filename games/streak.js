'use strict';
// GoLingo 365-day streak beta: one authenticated, server-timestamped game
// GALLERY LAUNCH per UTC day. This does not verify gameplay or grant cash.
(async () => {
  const days=document.getElementById('challenge-days');
  const message=document.getElementById('challenge-message');
  const progress=document.getElementById('challenge-progress');
  const fill=document.getElementById('challenge-fill');
  const milestone=document.getElementById('challenge-milestone');
  if(!days||!message||!progress||!fill||!milestone)return;
  let db=null,initialized=false,knownOwner=null,active=false,lastError='',refreshing=false;
  const user=()=>window.GoLingoCognito?.getUser?.()||null;
  function render(record){
    const streak=Number(record?.streak)||0;
    const longest=Number(record?.longest)||0;
    const total=Number(record?.total_days)||0;
    days.textContent=streak.toLocaleString();
    const width=Math.min(100,(streak/365)*100);
    progress.setAttribute('aria-valuenow',String(Math.min(365,streak)));
    fill.style.width=width+'%';
    milestone.hidden=!record?.goal_reached;
    if(record?.goal_reached){
      message.textContent='Milestone completed! '+longest+' consecutive recorded launch days at your longest streak. This is not cash-prize approval.';
    }else if(record?.done_today){
      message.textContent='Today recorded ✓ · '+streak+' consecutive day'+(streak===1?'':'s')+
        ' · '+Math.max(0,365-streak)+' to reach your streak milestone.';
    }else if(streak){
      message.textContent=streak+' consecutive days · Open a game from the gallery today to keep your streak.';
    }else if(total){
      message.textContent='Start a new streak today. Your longest recorded streak was '+longest+' days.';
    }else {
      message.textContent='Open a game from the GoLingo gallery to record your first streak day.';
    }
  }
  function signedOut(){
    knownOwner=null;
    days.textContent='—';
    progress.setAttribute('aria-valuenow','0');
    fill.style.width='0%';
    milestone.hidden=true;
    message.textContent='Sign in with GoLingo to track your daily game-launch streak.';
  }
  function setupMissing(error){
    lastError=String(error?.message||error);
    message.textContent=lastError.includes('Could not find the function')||
      lastError.includes('PGRST202')?
      'Daily streak tracking is pending Supabase setup. Existing games still work.':
      'Streak unavailable: '+lastError;
  }
  async function refresh(){
    if(!initialized||refreshing)return;
    const current=user();
    if(!current){signedOut();return}
    const owner=current.id;
    refreshing=true;
    try{
      const {data,error}=await db.rpc('golingo_get_daily_game_streak');
      if(error)throw error;
      if(owner!==user()?.id)return;
      knownOwner=owner;
      const item=Array.isArray(data)?data[0]:data;
      render(item||null);
    }catch(error){setupMissing(error)}
    finally{refreshing=false}
  }
  async function recordLaunch(gameId){
    if(!canTrack())return;
    const owner=user()?.id;
    try{
      const {data,error}=await db.rpc('golingo_mark_daily_game_launch',{p_game_id:gameId});
      if(error)throw error;
      if(owner!==user()?.id)return;
      const item=Array.isArray(data)?data[0]:data;
      if(item)render(item);
    }catch(error){
      // A failed server request NEVER counts as a streak day.
      setupMissing(error);
      throw error;
    }
  }
  function canTrack(){
    return initialized&&!!db&&!!user()?.id&&!!window.GoLingoCognito?.getToken?.();
  }
  window.GoLingoStreak={canTrack,recordLaunch,refresh};
  window.addEventListener('golingo:auth-state',()=>{if(initialized)refresh()});
  window.addEventListener('pageshow',()=>{if(initialized)refresh()});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&initialized)refresh();
  });
  // Native Cognito bridge can finish after other gallery scripts initialize.
  let lastSeen=null;
  setInterval(()=>{
    const current=user()?.id||null;
    if(current!==lastSeen){
      lastSeen=current;
      if(initialized)refresh();
      else if(!current)signedOut();
    }
  },3500);
  try{
    const response=await fetch('cloud-config.json',{cache:'no-store'});
    if(!response.ok)throw Error('Cloud configuration missing');
    const config=await response.json();
    for(let i=0;i<70&&!window.supabase?.createClient;i++)
      await new Promise(resolve=>setTimeout(resolve,120));
    if(!window.supabase?.createClient)throw Error('Supabase client unavailable');
    db=window.supabase.createClient(config.url,config.anonKey,{
      accessToken:async()=>window.GoLingoCognito?.getToken?.()||null,
      auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
    });
    initialized=true;
    await refresh();
  }catch(error){setupMissing(error)}
})();
