'use strict';
// GoLingo public launch / like counts + per-Cognito-account likes / favorites.
// Browser never receives database service credentials. Supabase RLS and RPCs
// in game-social-schema.sql enforce account ownership and counter updates.
(async () => {
  const gameIds = [...document.querySelectorAll('.game-card[id]')].map(x => x.id);
  const gameSet = new Set(gameIds);
  const pendingKey='golingo:pending-game-launches:v1';
  const deviceKey='golingo:gallery-device-uuid:v1';
  let publicDb, accountDb, ready=false, refreshing=false, refreshRequested=false, flushing=false, inFlight=new Set();
  let totals=Object.create(null), likes=Object.create(null), favorites=Object.create(null);
  let owner=null;
  const cloudStatus=document.getElementById('cloud-status');
  const storageStatus=document.getElementById('hub-storage-status');
  const notify=text=>{if(cloudStatus)cloudStatus.textContent=text;};
  function deviceId(){
    try {
      const saved=localStorage.getItem(deviceKey);
      if(saved && /^[0-9a-f-]{36}$/i.test(saved))return saved;
      const created=crypto.randomUUID();
      localStorage.setItem(deviceKey,created);return created;
    } catch { return null; }
  }
  function currentUser(){
    const value=window.GoLingoCognito?.getUser?.();
    return value?.id || null;
  }
  function asMap(rows){
    const values=Object.create(null);
    for(const row of rows||[])if(gameSet.has(row.game_id))values[row.game_id]=true;
    return values;
  }
  function render(){
    window.GoLingoGallerySetSocial?.({
      totals, likes, accountFavorites:favorites, signedIn:!!owner
    });
  }
  async function readMetrics(){
    const {data,error}=await publicDb.from('golingo_game_metrics')
      .select('game_id,play_count,like_count').limit(300);
    if(error) throw error;
    const map=Object.create(null);
    for(const item of data||[]){
      if(gameSet.has(item.game_id)){
        map[item.game_id]={
          plays:Math.max(0,Number(item.play_count)||0),
          likes:Math.max(0,Number(item.like_count)||0)
        };
      }
    }
    totals=map;
  }
  async function refresh(){
    if(!ready)return;
    if(refreshing){refreshRequested=true;return}
    refreshing=true;
    try{
      await readMetrics();
      const account=currentUser();
      if(account){
        const [likeResponse,favResponse]=await Promise.all([
          accountDb.from('golingo_game_likes').select('game_id').eq('user_id',account),
          accountDb.from('golingo_game_favorites').select('game_id').eq('user_id',account)
        ]);
        if(likeResponse.error)throw likeResponse.error;
        if(favResponse.error)throw favResponse.error;
        if(account!==currentUser())return;
        owner=account;
        likes=asMap(likeResponse.data);
        favorites=asMap(favResponse.data);
      }else{
        owner=null;likes=Object.create(null);favorites=Object.create(null);
      }
      render();
    }catch(error){
      if(storageStatus){
        storageStatus.textContent='Shared counts and account favorites are not available yet. Run game-social-schema.sql in Supabase. '+error.message;
      }
    }finally{
      refreshing=false;
      if(refreshRequested){refreshRequested=false;queueMicrotask(()=>refresh())}
    }
  }
  function queue(){
    try{
      const list=JSON.parse(localStorage.getItem(pendingKey)||'[]');
      return Array.isArray(list)?list.filter(x=>gameSet.has(x)).slice(0,80):[];
    }catch{return []}
  }
  async function flushLaunches(){
    if(!ready||flushing)return;
    const id=deviceId();if(!id)return;
    flushing=true;
    try{
      let rest=queue();
      while(rest.length){
        const gameId=rest[0];
        const {error}=await publicDb.rpc('golingo_record_game_play',
          {p_game_id:gameId,p_device_id:id});
        if(error)throw error;
        rest.shift();
        try{localStorage.setItem(pendingKey,JSON.stringify(rest))}catch{}
      }
      await refresh();
    }catch(error){
      // Retain queued launches on network errors or missing database functions.
      if(storageStatus&&!Object.keys(totals).length)
        storageStatus.textContent='Shared game statistics are awaiting Supabase setup. '+error.message;
    }finally{flushing=false}
  }
  function reactionFeedback(gameId,text,isError=false){
    const host=document.getElementById(gameId)?.querySelector('.game-actions');
    if(!host)return;
    let line=host.querySelector('.game-social-feedback');
    if(!line){line=document.createElement('small');line.className='game-social-feedback';line.setAttribute('role','status');host.append(line)}
    line.textContent=text;
    line.classList.toggle('is-error',isError);
  }
  function signInPrompt(){
    notify('Likes and cloud favorites require the GoLingo app. Download GoLingo and open Online Games inside the app.');
    document.getElementById('golingo-cloud')?.scrollIntoView({behavior:'smooth',block:'center'});
  }
  async function toggleLike(gameId){
    if(!gameSet.has(gameId)||inFlight.has('like:'+gameId))return;
    if(!currentUser()){signInPrompt();return}
    inFlight.add('like:'+gameId);
    try{
      const {error}=await accountDb.rpc('golingo_set_game_like',
        {p_game_id:gameId,p_liked:!likes[gameId]});
      if(error)throw error;
      await refresh();
    }catch(error){notify('Like could not be saved: '+error.message)}
    finally{inFlight.delete('like:'+gameId)}
  }
  const appStoreUrl='https://apps.apple.com/us/app/learn-lingo-with-golingo-ai/id1194977025';
  let favoriteInvite=null;
  function showFavoriteInvite(gameId){
    if(favoriteInvite?.isConnected)favoriteInvite.remove();
    const isApp=!!window.GoLingoCognito?.nativeAvailable?.();
    const gameName=document.getElementById(gameId)?.querySelector('h3')?.textContent?.trim()||'this game';
    const shade=document.createElement('div');
    shade.className='favorite-invite-shade';
    const dialog=document.createElement('section');
    dialog.className='favorite-invite-dialog';
    dialog.setAttribute('role','dialog');
    dialog.setAttribute('aria-modal','true');
    const heading=document.createElement('h2');
    heading.id='favorite-invite-title';
    heading.textContent=isApp?'Sign in to save your favorites':'Get GoLingo to favorite games';
    dialog.setAttribute('aria-labelledby',heading.id);
    const description=document.createElement('p');
    description.textContent=isApp
      ?'Sign in to your GoLingo account inside the app. Then return to Online Games to favorite '+gameName+', save your learning data, and publish games using your own words and sentences.'
      :'Download GoLingo for iPhone and open Online Games inside the app. You can favorite '+gameName+', save your learning data, and publish games with your own words and sentences.';
    const features=document.createElement('ul');
    for(const feature of ['♡ Save favorite games to your GoLingo account','✓ Save words, sentences, and lesson history','↗ Publish and share games with your own learning content']){
      const item=document.createElement('li');item.textContent=feature;features.append(item);
    }
    const buttons=document.createElement('div');buttons.className='favorite-invite-actions';
    if(!isApp){
      const download=document.createElement('a');
      download.href=appStoreUrl;download.className='favorite-invite-download';
      download.textContent='Download GoLingo for iPhone';
      buttons.append(download);
    }
    const close=document.createElement('button');
    close.type='button';close.className='favorite-invite-close';
    close.textContent=isApp?'Got it':'Not now';
    buttons.append(close);
    const note=document.createElement('small');
    note.textContent=isApp
      ?'Already signed in? Reopen Online Games to reconnect your account.'
      :'GoLingo is currently available for Apple iPhone (iOS). Browser visitors can play games, but account favorites and cloud publishing require GoLingo.';
    dialog.append(heading,description,features,buttons,note);
    shade.append(dialog);document.body.append(shade);favoriteInvite=shade;
    const trigger=document.activeElement;
    const dismiss=()=>{
      shade.remove();
      document.removeEventListener('keydown',onKey);
      if(favoriteInvite===shade)favoriteInvite=null;
      trigger?.focus?.({preventScroll:true});
    };
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();dismiss()}
      if(event.key==='Tab'){
        const focusable=[...dialog.querySelectorAll('a[href],button:not([disabled])')];
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
      }
    };
    close.addEventListener('click',dismiss);
    shade.addEventListener('click',event=>{if(event.target===shade)dismiss()});
    document.addEventListener('keydown',onKey);
    (dialog.querySelector('a')||close).focus();
  }
  async function toggleFavorite(gameId){
    if(!gameSet.has(gameId)||inFlight.has('fav:'+gameId))return;
    const account=currentUser();
    if(!account){showFavoriteInvite(gameId);return}
    inFlight.add('fav:'+gameId);
    const adding=!favorites[gameId];
    reactionFeedback(gameId,'Saving favorite…');
    try{
      const response=favorites[gameId]
        ? await accountDb.from('golingo_game_favorites').delete()
           .eq('user_id',account).eq('game_id',gameId)
        : await accountDb.from('golingo_game_favorites')
           .insert({user_id:account,game_id:gameId});
      if(response.error && !(adding && response.error.code==='23505'))throw response.error;
      favorites[gameId]=adding;
      if(!adding)delete favorites[gameId];
      render();
      reactionFeedback(gameId,adding?'♥ Added to your GoLingo favorites':'Removed from favorites');
      await refresh();
    }catch(error){
      reactionFeedback(gameId,'Favorite could not be saved: '+error.message,true);
      notify('Favorite could not be saved: '+error.message);
      await refresh();
    }finally{inFlight.delete('fav:'+gameId)}
  }
  async function importDeviceReactions(){
    const account=currentUser();
    if(!account){signInPrompt();return}
    const okay=window.GoLingoConfirm
      ? await window.GoLingoConfirm('Import earlier likes and favorites?',
        'Import only your own device likes and favorites into this GoLingo account.',
        'Import my favorites')
      : false;
    if(!okay)return;
    let oldLikes={},oldFavorites={};
    try{oldLikes=JSON.parse(localStorage.getItem('golingo:liked-games:v1')||'{}')||{}}catch{}
    try{oldFavorites=JSON.parse(localStorage.getItem('golingo:favorite-games:v1')||'{}')||{}}catch{}
    const favIds=gameIds.filter(id=>oldFavorites[id]===true);
    const likeIds=gameIds.filter(id=>oldLikes[id]===true);
    const button=document.getElementById('social-import-legacy');
    if(button)button.disabled=true;
    try{
      if(favIds.length){
        const records=favIds.map(gameId=>({user_id:account,game_id:gameId}));
        const {error}=await accountDb.from('golingo_game_favorites')
          .upsert(records,{onConflict:'user_id,game_id'});
        if(error)throw error;
      }
      for(const id of likeIds){
        const {error}=await accountDb.rpc('golingo_set_game_like',
          {p_game_id:id,p_liked:true});
        if(error)throw error;
      }
      await refresh();
      notify('Imported '+favIds.length+' favorites and '+likeIds.length+' likes into your GoLingo account.');
    }catch(error){notify('Could not finish importing: '+error.message)}
    finally{if(button)button.disabled=false}
  }
  document.getElementById('social-import-legacy')?.addEventListener('click',importDeviceReactions);
  window.GoLingoSocial={toggleLike,toggleFavorite,refresh,importDeviceReactions};
  window.addEventListener('golingo:auth-state',()=>{if(ready)refresh()});
  window.addEventListener('golingo:game-launch',()=>{if(ready)flushLaunches()});
  window.addEventListener('pageshow',()=>{if(ready){refresh();flushLaunches()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready){refresh();flushLaunches()}});
  try{
    const res=await fetch('cloud-config.json',{cache:'no-store'});
    if(!res.ok)throw Error('Missing Supabase configuration');
    const config=await res.json();
    // cloud.js loads the UMD library independently. Wait for its completion,
    // rather than racing a second script insert against it.
    for(let attempt=0;attempt<60&&!window.supabase?.createClient;attempt++)
      await new Promise(resolve=>setTimeout(resolve,150));
    if(!window.supabase?.createClient)throw Error('Supabase client library unavailable');
    const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
    publicDb=window.supabase.createClient(config.url,config.anonKey,options);
    accountDb=window.supabase.createClient(config.url,config.anonKey,{
      accessToken:async()=>window.GoLingoCognito?.getToken?.() || null,
      ...options
    });
    ready=true;
    await refresh();
    flushLaunches();
  }catch(error){
    if(storageStatus)storageStatus.textContent='Shared game metrics are unavailable: '+error.message;
  }
})();
