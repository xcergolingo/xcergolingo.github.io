'use strict';
/* Optional cloud sync and public sharing for GoLingo game lesson history.
   This file is inert until the owner configures games/cloud-config.json and
   runs cloud-schema.sql with Row-Level Security enabled. */
(async () => {
  const root = document.getElementById('golingo-cloud');
  if (!root) return;
  const status = document.getElementById('cloud-status');
  const authArea = document.getElementById('cloud-auth');
  const signedArea = document.getElementById('cloud-signed-in');
  const signInButton = document.getElementById('cloud-sign-in');
  const signOutButton = document.getElementById('cloud-sign-out');
  const syncButton = document.getElementById('cloud-sync');
  const sharedList = document.getElementById('cloud-community-list');
  const sharedRefresh = document.getElementById('cloud-community-refresh');
  const mineList = document.getElementById('cloud-published-list');
  const mineArea = document.getElementById('cloud-my-publications');
  const tableName = 'golingo_game_lessons';
  const localPrefix = 'golingo:game-lesson-history:v1:';
  const isSafeSubject = sub => typeof sub === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(sub);
  function scopedKey(gameId){return localPrefix + gameId + ':cognito:' + user.id;}
  const maxPerGame = 20;
  const counts = ['words', 'sentences', 'phrases', 'items', 'entries'];
  let db, publicDb, user = null, busy = false;
  let syncTimer;
  const validId = id => /^[a-z0-9-]{1,90}$/.test(id);
  function note(msg) { status.textContent = msg; }
  function lessonText(lesson) {
    const language = String(lesson.learningLanguage || lesson.language || lesson.targetLanguage || 'Language').slice(0, 30);
    const words = counts.flatMap(k => Array.isArray(lesson[k]) ? lesson[k] : [])
      .map(v => typeof v === 'string' ? v : (v?.word || v?.text || v?.phrase || v?.sentence || ''))
      .filter(Boolean).slice(0,3).map(s => String(s).replace(/\s+/g,' ').trim().slice(0,32));
    return language + (words.length ? ' · ' + words.join(' · ') : '');
  }
  function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k)+':'+canonical(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  async function fingerprint(lesson) {
    const bytes = new TextEncoder().encode(canonical(lesson));
    const hash = await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2,'0')).join('');
  }
  function localItems(gameId) {
    if(!user || !isSafeSubject(user.id)) return [];
    try {
      const raw = JSON.parse(localStorage.getItem(scopedKey(gameId))||'[]');
      return Array.isArray(raw) ? raw.filter(x => x?.lesson && x?.fingerprint).slice(0,maxPerGame) : [];
    } catch { return []; }
  }
  function installedCards() { return [...document.querySelectorAll('.game-card[id]')]; }
  function makeButton(title,handler,cls) {
    const btn=document.createElement('button');
    btn.type='button'; btn.className=cls||'hub-chip'; btn.textContent=title;
    btn.addEventListener('click',handler);
    return btn;
  }
  let publicationOwner = null;
  let publishedLessons = new Set();
  function publicationKey(gameId,lesson) { return gameId + '\u0000' + canonical(lesson); }
  function publicationStatus(gameId,lesson) {
    if (!user || publicationOwner !== user.id) return null;
    return publishedLessons.has(publicationKey(gameId,lesson));
  }
  function updatePublicationStates(data) {
    publicationOwner = user?.id || null;
    publishedLessons = new Set((data || []).filter(item => item.is_public)
      .map(item => publicationKey(item.game_id,item.lesson_json)));
    window.GoLingoGalleryRefreshHistory?.();
  }
  function renderSignedIn() {
    if (publicationOwner !== (user?.id || null)) {
      publicationOwner = null;
      publishedLessons.clear();
    }
    window.GoLingoSetLessonHistoryOwner?.(user?.id || null);
    const enabled=!!user;
    authArea.hidden=enabled;
    signedArea.hidden=!enabled;
    mineArea.hidden=!enabled;
    if (enabled) document.getElementById('cloud-account-label').textContent = user.email || 'Signed in';
    window.GoLingoGalleryRefreshHistory?.();
    window.dispatchEvent(new CustomEvent('golingo:auth-state',{detail:{signedIn:enabled}}));
  }
  function showError(error) { note('Cloud error: ' + (error?.message || String(error))); }
  // Serialize user actions and background sync. Previously a Publish tap
  // during synchronization silently returned without changing is_public.
  let taskTail=Promise.resolve();
  function disableWhileRunning(fn) {
    return () => {
      const task=taskTail.catch(()=>{}).then(async()=>{
        busy=true; syncButton.disabled=true;
        try { await fn(); } catch(error) { showError(error); }
        finally { busy=false; syncButton.disabled=false; }
      });
      taskTail=task;
      return task;
    };
  }
  async function saveRemote(gameId,lesson,lastPlayed) {
    if (!user || !validId(gameId) || !lesson || JSON.stringify(lesson).length>100000) return;
    const fp=await fingerprint(lesson);
    const base={user_id:user.id,game_id:gameId,fingerprint:fp,
      title:lessonText(lesson),lesson_json:lesson,
      last_played_at:new Date(lastPlayed || Date.now()).toISOString(), is_public:false};
    // Do not overwrite an existing row's publication state when replaying.
    const {error:insertError}=await db.from(tableName).upsert(base,
      {onConflict:'user_id,game_id,fingerprint',ignoreDuplicates:true});
    if(insertError) throw insertError;
    const {error:updateError}=await db.from(tableName)
      .update({last_played_at:base.last_played_at})
      .eq('user_id',user.id).eq('game_id',gameId).eq('fingerprint',fp).lt('last_played_at',base.last_played_at);
    if(updateError) throw updateError;
  }
  async function fetchMine() {
    const {data,error}=await db.from(tableName)
      .select('id,game_id,fingerprint,title,lesson_json,last_played_at,is_public')
      .eq('user_id',user.id).order('last_played_at',{ascending:false}).limit(1500);
    if (error) throw error;
    return data || [];
  }
  async function mergeRemote(data) {
    for (const card of installedCards()) {
      const gameId=card.id;
      const records=(data||[]).filter(x=>x.game_id===gameId);
      if(!records.length) continue;
      const merged=localItems(gameId);
      const seen=new Set(merged.map(x=>x.fingerprint));
      for (const row of records) {
        // Local uses the complete canonical lesson as its fingerprint.
        const localFingerprint=canonical(row.lesson_json);
        if (seen.has(localFingerprint)) {
          const existing=merged.find(x=>x.fingerprint===localFingerprint);
          if (existing && (Date.parse(row.last_played_at)||0)>existing.lastPlayed)
            existing.lastPlayed=Date.parse(row.last_played_at);
        } else {
          merged.push({fingerprint:localFingerprint,lesson:row.lesson_json,
            label:row.title,lastPlayed:Date.parse(row.last_played_at)||0});
          seen.add(localFingerprint);
        }
      }
      merged.sort((a,b)=>b.lastPlayed-a.lastPlayed);
      try { localStorage.setItem(scopedKey(gameId),JSON.stringify(merged.slice(0,maxPerGame))); }
      catch { note('Cloud loaded, but device storage is full or unavailable.'); }
    }
    window.GoLingoGalleryRefreshHistory?.();
  }
  async function refreshMine() {
    if (!user) return;
    const data=await fetchMine();
    updatePublicationStates(data);
    await mergeRemote(data);
    mineList.replaceChildren();
    const published=data.filter(x=>x.is_public);
    if(!published.length){mineList.textContent='You have not published any lessons.';return;}
    for (const item of published) {
      const li=document.createElement('li'); li.className='cloud-community-entry';
      const name=document.createElement('span'); name.textContent=item.title+' · '+item.game_id;
      const unpublish=makeButton('Unpublish',disableWhileRunning(async ()=>{
        const {error}=await db.from(tableName).update({is_public:false})
          .eq('id',item.id).eq('user_id',user.id);
        if(error) throw error;
        note('Lesson is private again.'); await refreshMine();await refreshCommunity();
      }),'cloud-row-action');
      li.append(name,unpublish);mineList.append(li);
    }
  }
  async function refreshCommunity() {
    const {data,error}=await publicDb.from(tableName)
      .select('id,game_id,title,lesson_json,last_played_at')
      .eq('is_public',true).order('last_played_at',{ascending:false}).limit(200);
    sharedList.replaceChildren();
    if(error) {
      sharedList.textContent='Unable to load community lessons: '+error.message;
      return;
    }
    const entries=(data||[]).filter(item=>validId(item.game_id) &&
      !!document.getElementById(item.game_id) && item.lesson_json);
    const summary=document.getElementById('cloud-community-summary');
    if(summary) summary.textContent='Community lessons · discover & play ('+entries.length+')';
    if(!entries.length){
      sharedList.textContent='No public lessons found yet. Published lessons will appear here for everyone, including visitors not signed in.';
      document.querySelectorAll('.game-community').forEach(panel=>panel.remove());
      return;
    }
    // Place public lessons under their matching game as well as in the
    // gallery-wide community collection. No login is required to replay.
    for(const card of installedCards()) {
      const copy=card.querySelector('.game-copy');
      if(!copy)continue;
      let panel=copy.querySelector('.game-community');
      const own=entries.filter(item=>item.game_id===card.id);
      if(!own.length){panel?.remove();continue}
      if(!panel){
        panel=document.createElement('details');
        panel.className='game-community';
        copy.append(panel);
      }
      panel.replaceChildren();
      const summary=document.createElement('summary');
      summary.textContent='Community lessons · '+own.length+' shared';
      panel.append(summary);
      const list=document.createElement('ul');
      list.className='game-community-list';
      for(const item of own.slice(0,25)){
        const li=document.createElement('li');
        const label=document.createElement('span');
        label.textContent=item.title || lessonText(item.lesson_json);
        const play=makeButton('Play',()=>{
          try {window.GoLingoPlaySavedLesson?.(item.game_id,item.lesson_json)}
          catch(error){showError(error)}
        },'cloud-row-action');
        li.append(label,play);list.append(li);
      }
      panel.append(list);
    }
    for(const item of entries) {
      const li=document.createElement('li');li.className='cloud-community-entry';
      const label=document.createElement('span');
      const game=document.getElementById(item.game_id)?.querySelector('h3')?.textContent || item.game_id;
      label.textContent=(item.title || lessonText(item.lesson_json))+' · '+game;
      const play=makeButton('Play lesson',()=> {
        try { window.GoLingoPlaySavedLesson?.(item.game_id,item.lesson_json); }
        catch(error){showError(error);}
      },'cloud-row-action');
      li.append(label,play);sharedList.append(li);
    }
  }
  const syncNow=disableWhileRunning(async ()=>{
    if(!user) { note('Sign in before syncing.');return; }
    note('Syncing private lesson histories…');
    let uploaded=0;
    for(const card of installedCards()) {
      for(const item of localItems(card.id)) {
        await saveRemote(card.id,item.lesson,item.lastPlayed);
        uploaded++;
      }
    }
    await refreshMine();
    await refreshCommunity();
    note('Cloud sync complete · '+uploaded+' local lessons checked. Duplicates are not created.');
  });
  async function publish(gameId,lesson) {
    if(!user) { note('Sign in to publish a lesson.');return; }
    if(!confirm('Publish this entire lesson publicly for other GoLingo players? All words, sentences, and translations in it will be visible.')) return;
    const wrapped=disableWhileRunning(async ()=>{
      note('Publishing lesson…');
      await saveRemote(gameId,lesson,Date.now());
      const fp=await fingerprint(lesson);
      const {data,error}=await db.from(tableName).update({is_public:true})
        .eq('user_id',user.id).eq('game_id',gameId).eq('fingerprint',fp)
        .select('id,is_public');
      if(error) throw error;
      if(!data?.length || !data[0].is_public) throw Error('Could not confirm publication.');
      await refreshMine();await refreshCommunity();
      // Confirm visibility through the anonymous client, not only the owner.
      const {data:publicRows,error:publicError}=await publicDb.from(tableName)
        .select('id').eq('id',data[0].id).eq('is_public',true).limit(1);
      if(publicError || !publicRows?.length)
        throw Error('Published for your account, but public visibility could not be verified. Please retry Sync or contact support.');
      note('✓ Published and visible to other GoLingo players.');
    });
    await wrapped();
  }
  async function unpublish(gameId,lesson) {
    if (!user || publicationStatus(gameId,lesson) !== true) return;
    if (!confirm('Remove this lesson from public sharing? Your private history will remain saved.')) return;
    const wrapped=disableWhileRunning(async ()=>{
      note('Unpublishing lesson…');
      const fp=await fingerprint(lesson);
      const {data,error}=await db.from(tableName).update({is_public:false})
        .eq('user_id',user.id).eq('game_id',gameId).eq('fingerprint',fp)
        .select('id,is_public');
      if(error) throw error;
      if(!data?.length) throw Error('Could not confirm that this lesson was unpublished.');
      await refreshMine();await refreshCommunity();
      note('Lesson unpublished. It remains in your private history.');
    });
    await wrapped();
  }
  window.GoLingoCloud={isSignedIn:()=>!!user,publicationStatus,publish,unpublish};
  window.addEventListener('golingo:game-lesson-played',e=>{
    if(!user) return;
    const {gameId,lesson}=e.detail||{};
    if(!validId(gameId) || !lesson) return;
    // Queue rather than blocking native link navigation; on return sync scans
    // any locally saved launches that did not finish uploading before navigation.
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>saveRemote(gameId,lesson,Date.now()).catch(showError),150);
  });
  window.addEventListener('pageshow',()=>{
    if(user) syncNow();
  });
  try {
    const configResponse=await fetch('cloud-config.json',{cache:'no-store'});
    if(!configResponse.ok) throw Error('not-configured');
    const config=await configResponse.json();
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url||'') ||
       typeof config.anonKey!=='string' || config.anonKey.length<20) throw Error('not-configured');
    const library=document.createElement('script');
    library.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    await new Promise((resolve,reject)=>{
      library.onload=resolve;library.onerror=()=>reject(Error('Cloud library could not load'));
      document.head.append(library);
    });
    if(!window.supabase?.createClient) throw Error('Cloud library unavailable');
    // Always read public lessons anonymously; Cognito account credentials are
    // never required for the community listing.
    publicDb=window.supabase.createClient(config.url,config.anonKey,{
      auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
    });
    if (!config.cognito?.enabled) {
      authArea.hidden=true;signedArea.hidden=true;mineArea.hidden=true;
      document.getElementById('cloud-community').hidden=true;
      note('Cognito cloud authentication is staged but not active yet. Complete AWS role-claim and database migration steps first. Local lessons still work.');
      return;
    }
    if(!window.GoLingoCognito)throw Error('Cognito authentication bridge not loaded');
    db=window.supabase.createClient(config.url,config.anonKey,{
      accessToken:async()=>window.GoLingoCognito.getToken(),
      auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false}
    });
    await window.GoLingoCognito.initialize(config,profile=>{
      user=profile;renderSignedIn();
      if(profile)setTimeout(()=>syncNow(),0);
    });
    user=window.GoLingoCognito.getUser();
    signInButton.addEventListener('click',disableWhileRunning(async ()=>{
      if(window.GoLingoCognito.nativeAvailable()){
        window.GoLingoCognito.requestNativeToken();
        note('Requesting existing GoLingo app login…');
      }else await window.GoLingoCognito.signIn();
    }));
    signOutButton.addEventListener('click',()=>{
      window.GoLingoCognito.signOut();user=null;renderSignedIn();
      note('Signed out of game cloud. Local lessons remain on this device.');
    });
    const importLegacyButton=document.getElementById('cloud-import-legacy');
    importLegacyButton?.addEventListener('click',disableWhileRunning(async()=>{
      if(!user)return;
      if(!confirm('Import older device-only lessons into this GoLingo account? Only do this if all those lessons belong to you.'))return;
      let imported=0;
      for(const card of installedCards()){
        let legacy=[];
        try{legacy=JSON.parse(localStorage.getItem(localPrefix+card.id)||'[]');}catch{}
        if(!Array.isArray(legacy))continue;
        const current=localItems(card.id);
        const seen=new Set(current.map(x=>x.fingerprint));
        for(const item of legacy){
          if(!item?.lesson || typeof item.fingerprint!=='string' || seen.has(item.fingerprint))continue;
          current.push(item);seen.add(item.fingerprint);imported++;
        }
        if(current.length){
          current.sort((a,b)=>b.lastPlayed-a.lastPlayed);
          localStorage.setItem(scopedKey(card.id),JSON.stringify(current.slice(0,maxPerGame)));
        }
      }
      window.GoLingoGalleryRefreshHistory?.();
      note('Imported '+imported+' older device lessons. Syncing privately…');
      for(const card of installedCards()){
        for(const item of localItems(card.id))await saveRemote(card.id,item.lesson,item.lastPlayed);
      }
      await refreshMine();
      note('Older lessons imported and synchronized.');
    }));
    syncButton.addEventListener('click',syncNow);
    sharedRefresh.addEventListener('click',()=>refreshCommunity().catch(showError));
    root.dataset.ready='true';
    renderSignedIn();
    note(user?'Cognito account connected. Private cloud sync is available.':'Sign in with GoLingo to synchronize private lessons.');
    await refreshCommunity();
    if(user) await syncNow();
  }catch(error) {
    window.GoLingoCloud=null;
    root.dataset.ready='false';
    authArea.hidden=true;
    signedArea.hidden=true;
    mineArea.hidden=true;
    document.getElementById('cloud-community').hidden=true;
    note(error.message==='not-configured'
      ? 'Cloud sync and community sharing require an owner-configured Supabase project. Local lesson history still works.'
      : 'Cloud is unavailable: '+error.message+'. Local lesson history still works.');
  }
})();
