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
  const sharesEl=document.getElementById('challenge-shares');
  const publishedEl=document.getElementById('challenge-published');
  const engagementStatus=document.getElementById('challenge-engagement-status');
  const shareGamesButton=document.getElementById('challenge-share-games');
  let engagementOwner=null;
  function resetEngagement(){
    engagementOwner=null;
    if(sharesEl)sharesEl.textContent='—';
    if(publishedEl)publishedEl.textContent='—';
    if(engagementStatus)engagementStatus.textContent='Sign in inside the GoLingo iPhone app to view your cloud activity counts.';
  }
  async function refreshEngagement(){
    if(!initialized||!db||!user()?.id){resetEngagement();return}
    const owner=user().id;
    try{
      const {data,error}=await db.rpc('golingo_get_game_engagement_counts');
      if(error)throw error;
      if(user()?.id!==owner)return;
      const result=Array.isArray(data)?data[0]:data;
      if(!result)throw Error('No activity counts found');
      engagementOwner=owner;
      sharesEl.textContent=(Number(result.share_actions)||0).toLocaleString();
      publishedEl.textContent=(Number(result.published_lessons)||0).toLocaleString();
      engagementStatus.textContent='Cloud account totals · share actions count copies and Share sheet completions, not confirmed recipients.';
    }catch(error){
      if(user()?.id!==owner)return;
      sharesEl.textContent='—';publishedEl.textContent='—';
      engagementStatus.textContent='Account counters need Supabase setup. Run game-campaign-engagement.sql.';
    }
  }
  async function recordShare(target,action){
    if(!canTrack())return false;
    if(typeof target!=='string'||!/^(gallery|game:[a-z0-9-]{1,90}|lesson:[0-9a-f-]{36})$/i.test(target))return false;
    if(!['copy','share'].includes(action))return false;
    try{
      const {error}=await db.rpc('golingo_record_game_share_action',{p_target:target,p_action:action});
      if(error)throw error;
      await refreshEngagement();
      return true;
    }catch(error){return false}
  }
  function recordEventAfterShare(action) {
    // Never infer that sharing actually reached a recipient.
    recordShare('gallery',action);
  }
  if(shareGamesButton)shareGamesButton.addEventListener('click',()=>{
    const url='https://xcergolingo.github.io/games/';
    const text='Explore GoLingo language-learning games! '+url;
    if(navigator.share) {
      // Keep native share synchronous with the user's tap.
      navigator.share({title:'GoLingo Games',text,url}).then(()=>{
        recordEventAfterShare('share');
      }).catch(async error=>{
        if(error?.name!=='AbortError') {
          if(engagementStatus)engagementStatus.textContent='Sharing unavailable. You can copy the link instead.';
        }
      });
    }else if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(url).then(()=>{
        recordEventAfterShare('copy');
        if(engagementStatus)engagementStatus.textContent='Games link copied. Share it with friends!';
      }).catch(()=>{
        if(engagementStatus)engagementStatus.textContent='Copy this URL to share: '+url;
      });
    }else{
      if(engagementStatus)engagementStatus.textContent='Copy this URL to share: '+url;
    }
  });

  const publicStats={
    active:document.getElementById('streak-active-users'),
    ever:document.getElementById('streak-365-users'),
    current:document.getElementById('streak-current-365'),
    silver:document.getElementById('streak-silver-count'),
    gold:document.getElementById('streak-gold-count'),
    diamond:document.getElementById('streak-diamond-count'),
    status:document.getElementById('streak-public-status')
  };
  const earnedMedal=document.getElementById('challenge-earned-medal');
  let publicDb=null;
  function renderMedal(longest){
    if(!earnedMedal)return;
    const tier=longest>=1095?['💎','Diamond']:longest>=730?['🥇','Gold']:longest>=365?['🥈','Silver']:null;
    earnedMedal.hidden=!tier;
    if(tier)earnedMedal.textContent=tier[0]+' '+tier[1]+' medal earned · Best streak '+longest+' days';
  }
  async function refreshPublicTotals(){
    if(!publicDb)return;
    try{
      const {data,error}=await publicDb.rpc('golingo_public_streak_totals');
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row)throw Error('No totals returned');
      for(const [field,name] of [['active','active_streak_users'],['ever','lifetime_365_users'],['current','current_365_users'],['silver','silver_medal_users'],['gold','gold_medal_users'],['diamond','diamond_medal_users']]){
        const number=Number(row[name]);
        publicStats[field].textContent=Number.isSafeInteger(number)&&number>=0?number.toLocaleString():'—';
      }
      publicStats.status.textContent='Live counts of recorded GoLingo gallery-launch streaks (UTC). Medal counts show each user’s highest earned tier.';
    }catch(error){
      publicStats.status.textContent='Public streak totals are awaiting database setup.';
    }
  }

  let missedStatus=null;
  function friendlyDate(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return String(value);
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
    renderMedal(longest);
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
    renderMedal(0);
    renderMissing(null);
    resetEngagement();
    message.textContent='Download or open GoLingo for iPhone. Sign in inside the app, then open Online Games to record your daily streak. Browser play does not qualify for the proposed reward campaign.';
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
      await refreshEngagement();
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
      refreshPublicTotals();
      refreshEngagement();
    }catch(error){
      // A failed server request NEVER counts as a streak day.
      setupMissing(error);
      throw error;
    }
  }
  function canTrack(){
    return initialized&&!!db&&!!user()?.id&&!!window.GoLingoCognito?.getToken?.();
  }
  window.GoLingoStreak={canTrack,recordLaunch,refresh,refreshEngagement,recordShare};
  window.addEventListener('golingo:community-changed',()=>{if(initialized)refreshEngagement()});
  window.addEventListener('golingo:auth-state',()=>{if(initialized)refresh()});
  window.addEventListener('pageshow',()=>{if(initialized)refresh()});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&initialized){refresh();refreshPublicTotals()}
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
    publicDb=window.supabase.createClient(config.url,config.anonKey,{
      auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
    });
    initialized=true;
    await Promise.all([refresh(),refreshPublicTotals()]);
  }catch(error){setupMissing(error)}
})();
