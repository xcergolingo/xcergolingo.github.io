'use strict';
// GoLingo 365-day streak beta: one authenticated, server-timestamped game
// GALLERY LAUNCH per UTC day. This does not verify gameplay or grant cash.
(async () => {
  const days=document.getElementById('challenge-days');
  const message=document.getElementById('challenge-message');
  const progress=document.getElementById('challenge-progress');
  const fill=document.getElementById('challenge-fill');
  const milestone=document.getElementById('challenge-milestone');
  const missedBox=document.getElementById('challenge-missed');
  const missedSummary=document.getElementById('challenge-missed-summary');
  const missedList=document.getElementById('challenge-missed-list');
  if(!days||!message||!progress||!fill||!milestone||!missedBox||!missedSummary||!missedList)return;
  let db=null,initialized=false,knownOwner=null,active=false,lastError='',refreshing=false;
  const user=()=>window.GoLingoCognito?.getUser?.()||null;
  let missedStatus=null;
  function friendlyDate(value){
    if(typeof value!=='string'||!/^\\d{4}-\\d{2}-\\d{2}$/.test(value))return String(value);
    const parts=value.split('-').map(Number);
    const date=new Date(Date.UTC(parts[0],parts[1]-1,parts[2],12));
    return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date);
  }
  function renderMissing(status){
    missedStatus=status||null;
    const count=Number(status?.missed_count)||0;
    if(!count){
      missedBox.hidden=true;missedList.replaceChildren();return;
    }
    missedBox.hidden=false;
    missedSummary.textContent=status.streak_reset
      ? 'Streak reset: '+count+' missed day'+(count===1?'':'s')+'. Your previous streak was '+(Number(status.previous_streak)||0)+' days.'
      : 'Previous streak break: '+count+' missed day'+(count===1?'':'s')+'. Your current streak restarted at Day 1.';
    const dates=Array.isArray(status.missed_dates)?status.missed_dates:[];
    missedList.replaceChildren();
    for(const date of dates){
      const element=document.createElement('li');
      element.textContent=friendlyDate(date);
      missedList.append(element);
    }
    if(count>dates.length){
      const element=document.createElement('li');
      element.textContent='… and '+(count-dates.length)+' earlier missed days';
      missedList.append(element);
    }
  }
  async function refreshMissing(owner){
    try{
      const {data,error}=await db.rpc('golingo_get_game_missed_days');
      if(error)throw error;
      if(owner!==user()?.id)return;
      const value=Array.isArray(data)?data[0]:data;
      renderMissing(value||null);
    }catch(error){
      missedBox.hidden=false;
      missedSummary.textContent='Missed-day history is awaiting the Supabase migration.';
      missedList.replaceChildren();
    }
  }
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
    renderMissing(null);
    message.textContent='Open Online Games inside the GoLingo app and sign in there to track your daily streak. Browser play does not qualify for the proposed reward campaign.';
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
      await refreshMissing(owner);
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
      await refreshMissing(owner);
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
