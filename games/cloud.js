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

  function gamePreviewSource(gameId) {
    const cover=document.getElementById(gameId)?.querySelector('a.game-cover img');
    if(!cover)return null;
    try {
      const src=new URL(cover.getAttribute('src'),location.href);
      // Never download arbitrary external images into the canvas.
      return src.origin===location.origin ? src.href : null;
    }catch {return null}
  }
  async function previewPng(gameId) {
    const source=gamePreviewSource(gameId);
    if(!source)return null;
    const image=new Image();
    image.decoding='async';
    image.src=source;
    await new Promise((resolve,reject)=>{
      if(image.complete && image.naturalWidth){resolve();return}
      image.onload=resolve;
      image.onerror=()=>reject(Error('Game preview unavailable'));
    });
    const canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=630;
    const context=canvas.getContext('2d');
    if(!context)return null;
    context.fillStyle='#16372d';context.fillRect(0,0,1200,630);
    const w=image.naturalWidth,h=image.naturalHeight;
    if(!w||!h)return null;
    const scale=Math.max(1200/w,630/h);
    context.drawImage(image,(1200-w*scale)/2,(630-h*scale)/2,w*scale,h*scale);
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  }
  function shareLesson(id,title,gameId) {
    if(!uuidValid(id)){note('This lesson does not have a valid public link yet.');return}
    const url=lessonShareUrl(id);
    const game=gameTitle(gameId);
    const shade=document.createElement('div');shade.className='golingo-confirm-shade';
    const dialog=document.createElement('section');dialog.className='golingo-confirm-dialog golingo-share-dialog';
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    const heading=document.createElement('h3');heading.textContent='Share game & lesson';
    const description=document.createElement('p');
    description.textContent='Share '+game+' with '+(title||'this lesson')+'. Anyone can open the link and play.';
    const imageSource=gamePreviewSource(gameId);
    if(imageSource){
      const preview=document.createElement('img');
      preview.className='golingo-share-preview';
      preview.src=imageSource;
      preview.alt=game+' game preview image';
      preview.loading='eager';
      dialog.append(heading,preview);
    }else{dialog.append(heading)}
    const link=document.createElement('input');link.type='text';link.readOnly=true;link.value=url;
    link.setAttribute('aria-label','Shareable game and lesson link');
    const message=document.createElement('p');message.className='golingo-share-message';message.setAttribute('role','status');
    const actions=document.createElement('div');actions.className='golingo-confirm-actions';
    const copy=makeButton('Copy link',async()=>{
      try{
        if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
        else {link.focus();link.select();if(!document.execCommand('copy'))throw Error('Copy unavailable')}
        message.textContent='Link copied. Paste it into a message to share.';
      }catch{link.focus();link.select();message.textContent='Select and copy the link above to share.'}
    });
    // Pre-render before the tap so Web Share can run with transient user
    // activation. A failed/unsupported image gracefully falls back to URL.
    let imageFile=null;
    const imageReady=previewPng(gameId).then(blob=>{
      if(blob && typeof File!=='undefined') {
        const file=new File([blob],gameId+'-golingo-game.png',{type:'image/png'});
        if(navigator.canShare?.({files:[file]}))imageFile=file;
      }
    }).catch(()=>{});
    const nativeShare=makeButton('Share with image',()=>{
      if(!navigator.share){
        link.focus();link.select();
        message.textContent='Native sharing unavailable. Copy the link above.';
        return;
      }
      const shareText='Play '+game+' with my GoLingo lesson:\n'+url;
      const content=imageFile
        ? {title:'GoLingo — '+game,text:shareText,files:[imageFile]}
        : {title:'GoLingo — '+game,text:shareText,url};
      // No await or asynchronous image conversion before navigator.share().
      navigator.share(content).then(()=>{
        message.textContent=imageFile?'Shared game image and lesson link.':
          'Shared lesson link. The image was unavailable or not supported.';
      }).catch(error=>{
        if(error?.name!=='AbortError')
          message.textContent='Could not open sharing. Use Copy link instead.';
      });
    });
    imageReady.then(()=>{nativeShare.textContent=imageFile?'Share with image':'Share link'})
      .catch(()=>{});
    const close=makeButton('Close',()=>finish());
    function finish(){shade.remove();document.removeEventListener('keydown',onKey)}
    function onKey(e){if(e.key==='Escape'){e.preventDefault();finish()}}
    shade.addEventListener('click',e=>{if(e.target===shade)finish()});
    document.addEventListener('keydown',onKey);
    actions.append(copy,nativeShare,close);
    dialog.append(description,link,message,actions);shade.append(dialog);document.body.append(shade);
    copy.focus();
  }
  function shareAction(id,title,gameId) {
    const button=makeButton('Share link',()=>shareLesson(id,title,gameId),'cloud-row-action cloud-share-action');
    button.setAttribute('aria-label','Share '+title+' as a link to play '+gameId);
    return button;
  }
  async function openSharedLink() {
    const params=new URLSearchParams(location.search);
    const shared=params.get('share');
    if(shared===null)return;
    const panel=document.getElementById('shared-lesson-landing');
    const heading=document.getElementById('shared-lesson-heading');
    const info=document.getElementById('shared-lesson-detail');
    const play=document.getElementById('shared-lesson-play');
    if(!panel || !heading || !info || !play)return;
    panel.hidden=false;
    heading.textContent='Opening shared GoLingo lesson…';
    info.textContent='Finding the published lesson and its game.';
    play.hidden=true;
    panel.scrollIntoView({block:'start'});
    if(!uuidValid(shared)) {
      heading.textContent='Invalid shared lesson link';
      info.textContent='The lesson link is incomplete or invalid.';
      return;
    }
    const {data,error}=await publicDb.from(tableName)
      .select('id,game_id,title,lesson_json')
      .eq('id',shared).eq('is_public',true).maybeSingle();
    if(error||!data){
      heading.textContent='Shared lesson unavailable';
      info.textContent=error?'Could not load this lesson. Please try again.':'This lesson is private, unpublished or no longer available.';
      return;
    }
    const card=document.getElementById(data.game_id);
    if(!validId(data.game_id)||!card?.classList.contains('game-card')||!data.lesson_json){
      heading.textContent='Game unavailable';
      info.textContent='This game is not available in the GoLingo gallery.';
      return;
    }
    heading.textContent='Play '+(card.querySelector('h3')?.textContent||'GoLingo Game');
    info.textContent=data.title||lessonText(data.lesson_json);
    play.hidden=false;
    play.onclick=()=>{
      try {
        window.GoLingoPlaySavedLesson?.(data.game_id,data.lesson_json);
      }catch(e){info.textContent='Unable to start game: '+e.message}
    };
    // A tap on the shared URL is enough to enter the game, including inside
    // GoLingo WKWebView. Explicit Play button remains if navigation is blocked.
    play.click();
  }

  let publicationOwner = null;
  let publishedLessons = new Set();
  let publishedLessonIds = new Map();
  const uuidValid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'');
  function lessonShareUrl(id) {
    const url=new URL('https://xcergolingo.github.io/games/');
    url.searchParams.set('share',id);
    return url.href;
  }
  function publicationId(gameId,lesson) {
    return user && publicationOwner===user.id ? publishedLessonIds.get(publicationKey(gameId,lesson)) || null : null;
  }
  function publicationKey(gameId,lesson) { return gameId + '\u0000' + canonical(lesson); }
  function publicationStatus(gameId,lesson) {
    if (!user || publicationOwner !== user.id) return null;
    return publishedLessons.has(publicationKey(gameId,lesson));
  }
  function updatePublicationStates(data) {
    publicationOwner = user?.id || null;
    const published=(data || []).filter(item=>item.is_public);
    publishedLessons = new Set(published.map(item => publicationKey(item.game_id,item.lesson_json)));
    publishedLessonIds = new Map(published.filter(item=>uuidValid(item.id))
      .map(item=>[publicationKey(item.game_id,item.lesson_json),item.id]));
    window.GoLingoGalleryRefreshHistory?.();
  }
  function renderSignedIn() {
    if (publicationOwner !== (user?.id || null)) {
      publicationOwner = null;
      publishedLessons.clear();
      publishedLessonIds.clear();
    }
    window.GoLingoSetLessonHistoryOwner?.(user?.id || null);
    const enabled=!!user;
    const inApp=!!window.GoLingoCognito?.nativeAvailable?.();
    const browserSignIn=document.getElementById('cloud-sign-in-browser');
    if(browserSignIn)browserSignIn.hidden=inApp;
    signInButton.hidden=!inApp;
    authArea.hidden=enabled;
    signedArea.hidden=!enabled;
    mineArea.hidden=!enabled;
    if (enabled) document.getElementById('cloud-account-label').textContent = user.email || 'Signed in through GoLingo';
    window.GoLingoGalleryRefreshHistory?.();
    window.dispatchEvent(new CustomEvent('golingo:auth-state',{detail:{signedIn:enabled}}));
  }
  function showError(error) {
    const text=error?.message || String(error);
    window.GoLingoCloudLastError=text;
    note('Cloud error: ' + text);
  }
  // WKWebView may suppress window.confirm() unless its UIDelegate implements
  // JavaScript confirmation panels. Use a real in-page confirmation instead.
  function confirmInPage(title,description,acceptText) {
    return new Promise(resolve=>{
      const previous=document.activeElement;
      const shade=document.createElement('div');
      shade.className='golingo-confirm-shade';
      const dialog=document.createElement('section');
      dialog.className='golingo-confirm-dialog';
      dialog.setAttribute('role','dialog');
      dialog.setAttribute('aria-modal','true');
      const heading=document.createElement('h3');
      heading.textContent=title;
      heading.id='golingo-confirm-title';
      dialog.setAttribute('aria-labelledby',heading.id);
      const message=document.createElement('p');message.textContent=description;
      const actions=document.createElement('div');actions.className='golingo-confirm-actions';
      const cancel=document.createElement('button');
      cancel.className='hub-chip';cancel.type='button';cancel.textContent='Cancel';
      const accept=document.createElement('button');
      accept.className='hub-chip golingo-confirm-accept';accept.type='button';
      accept.textContent=acceptText;
      actions.append(cancel,accept);dialog.append(heading,message,actions);
      shade.append(dialog);document.body.append(shade);
      function finish(value){
        document.removeEventListener('keydown',onKey,true);
        shade.remove();
        previous?.focus?.({preventScroll:true});
        resolve(value);
      }
      function onKey(event){
        if(event.key==='Escape'){event.preventDefault();finish(false)}
        if(event.key==='Tab'){
          const focusables=[cancel,accept];
          const index=focusables.indexOf(document.activeElement);
          event.preventDefault();
          focusables[(index+(event.shiftKey?1:3))%2].focus();
        }
      }
      document.addEventListener('keydown',onKey,true);
      cancel.addEventListener('click',()=>finish(false));
      accept.addEventListener('click',()=>finish(true));
      shade.addEventListener('click',event=>{if(event.target===shade)finish(false)});
      cancel.focus();
    });
  }

  window.GoLingoConfirm=confirmInPage;
  // Serialize user actions and background sync. Previously a Publish tap
  // during synchronization silently returned without changing is_public.
  let taskTail=Promise.resolve();
  function disableWhileRunning(fn) {
    return () => {
      const task=taskTail.catch(()=>{}).then(async()=>{
        busy=true; syncButton.disabled=true;
        try { return await fn(); }
        catch(error) { showError(error); return false; }
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
      li.append(name,shareAction(item.id,item.title,item.game_id),unpublish);mineList.append(li);
    }
  }

  const community={rows:[],visible:1};
  const communitySearch=document.getElementById('community-search');
  const communityGame=document.getElementById('community-game');
  const communityLearning=document.getElementById('community-learning');
  const communityNative=document.getElementById('community-native');
  const communityGroup=document.getElementById('community-group');
  const communityMore=document.getElementById('community-more');
  const communityCount=document.getElementById('community-count');
  const langFallback={en:'English',it:'Italian',ja:'Japanese',zh:'Chinese',es:'Spanish',
    fr:'French',de:'German',pt:'Portuguese',ko:'Korean',vi:'Vietnamese',ru:'Russian',
    ar:'Arabic',hi:'Hindi',th:'Thai',uk:'Ukrainian',nl:'Dutch',id:'Indonesian',
    he:'Hebrew','zh-Hans':'Chinese (Simplified)','zh-Hant':'Chinese (Traditional)'};
  const displayNames=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['en'],{type:'language'}):null;
  function langCode(value){
    if(!value||typeof value!=='string')return '';
    const original=value.trim();
    if(/^(zh-CHS|zh-CN)$/i.test(original))return 'zh-Hans';
    if(/^(zh-CHT|zh-TW)$/i.test(original))return 'zh-Hant';
    if(/^(vi-VN)$/i.test(original))return 'vi';
    if(/^(iw)$/i.test(original))return 'he';
    const code=original.split(/[-_]/)[0].toLowerCase();
    return /^[a-z]{2,3}$/.test(code)?code:original;
  }
  function langName(value){
    const code=langCode(value);
    if(!code)return 'Unspecified';
    if(langFallback[code])return langFallback[code];
    try{
      const name=displayNames?.of(code);
      if(name&&name.toLowerCase()!==code.toLowerCase())return name;
    }catch{}
    return code;
  }
  const learning=lesson=>langCode(lesson?.learningLanguage||lesson?.targetLanguage||lesson?.language||lesson?.to);
  const native=lesson=>langCode(lesson?.primaryLanguage||lesson?.translationLanguage||lesson?.nativeLanguage||lesson?.from);
  const languagePair=lesson=>langName(learning(lesson))+' → '+langName(native(lesson));
  const gameTitle=id=>document.getElementById(id)?.querySelector('h3')?.textContent?.trim()||id;
  function humanLessonTitle(item){
    const title=String(item.title||'').trim();
    const code=learning(item.lesson_json);
    const first=title.split(' · ');
    if(first.length>1 && (langCode(first[0])===code || first[0].toLowerCase()===code))
      return first.slice(1).join(' · ');
    if(title)return title;
    return counts.flatMap(k=>Array.isArray(item.lesson_json?.[k])?item.lesson_json[k]:[])
      .map(x=>typeof x==='string'?x:x?.word||x?.sentence||x?.text||x?.phrase||'')
      .filter(Boolean).slice(0,3).join(' · ')||'Language lesson';
  }
  function searchable(row){
    const wordText=counts.flatMap(field=>Array.isArray(row.lesson_json?.[field])?row.lesson_json[field]:[])
      .map(v=>typeof v==='string'?v:Object.values(v||{}).filter(x=>typeof x==='string').join(' ')).join(' ');
    return [row.title,gameTitle(row.game_id),languagePair(row.lesson_json),wordText].join(' ').toLocaleLowerCase();
  }
  function populate(select,values,label){
    const prior=select.value;
    const vals=[...new Set(values.filter(Boolean))].sort((a,b)=>label(a).localeCompare(label(b)));
    const first=select.options[0].textContent;
    select.replaceChildren(new Option(first,''));
    for(const value of vals)select.add(new Option(label(value),value));
    select.value=vals.includes(prior)?prior:'';
  }
  function renderCommunity(){
    let rows=community.rows.filter(row=>
      (!communitySearch.value.trim()||searchable(row).includes(communitySearch.value.trim().toLocaleLowerCase())) &&
      (!communityGame.value||row.game_id===communityGame.value) &&
      (!communityLearning.value||learning(row.lesson_json)===communityLearning.value) &&
      (!communityNative.value||native(row.lesson_json)===communityNative.value));
    const grouped=communityGroup.value;
    if(grouped!=='latest'){
      const groupLabel=row=>grouped==='game'?gameTitle(row.game_id):grouped==='learning'?langName(learning(row.lesson_json)):langName(native(row.lesson_json));
      rows=[...rows].sort((a,b)=>groupLabel(a).localeCompare(groupLabel(b))||
        Date.parse(b.last_played_at)-Date.parse(a.last_played_at));
    }
    const count=Math.min(community.visible,rows.length);
    sharedList.replaceChildren();
    for(const item of rows.slice(0,count)){
      const li=document.createElement('li');li.className='cloud-community-entry community-entry';
      const text=document.createElement('div');text.className='community-entry-text';
      const languages=document.createElement('strong');languages.textContent=languagePair(item.lesson_json);
      const title=document.createElement('span');title.textContent=humanLessonTitle(item);
      const game=document.createElement('small');game.textContent=gameTitle(item.game_id);
      text.append(languages,title,game);
      const actions=document.createElement('div');actions.className='community-entry-actions';
      const play=makeButton('Play lesson',()=>{
        try{window.GoLingoPlaySavedLesson?.(item.game_id,item.lesson_json)}
        catch(error){showError(error)}
      },'cloud-row-action');
      actions.append(play,shareAction(item.id,item.title||lessonText(item.lesson_json),item.game_id));
      li.append(text,actions);sharedList.append(li);
    }
    if(!rows.length){const empty=document.createElement('li');empty.className='community-empty';empty.textContent=community.rows.length?'No matching lessons.':'No public lessons yet.';sharedList.append(empty)}
    communityCount.textContent='Showing '+count+' of '+rows.length+' published lessons';
    communityMore.hidden=count>=rows.length;
    communityMore.textContent='More · next '+Math.min(3,rows.length-count);
  }
  function communityReset(){community.visible=1;renderCommunity()}
  communitySearch.addEventListener('input',communityReset);
  for(const select of [communityGame,communityLearning,communityNative,communityGroup])
    select.addEventListener('change',communityReset);
  communityMore.addEventListener('click',()=>{community.visible+=3;renderCommunity()});

  async function refreshCommunity() {
    const {data,error}=await publicDb.from(tableName)
      .select('id,game_id,title,lesson_json,last_played_at')
      .eq('is_public',true).order('last_played_at',{ascending:false}).limit(200);
    if(error){sharedList.textContent='Community lessons unavailable: '+error.message;communityMore.hidden=true;return}
    const entries=(data||[]).filter(item=>validId(item.game_id) &&
      !!document.getElementById(item.game_id) && item.lesson_json);
    community.rows=entries;
    populate(communityGame,entries.map(item=>item.game_id),gameTitle);
    populate(communityLearning,entries.map(item=>learning(item.lesson_json)),langName);
    populate(communityNative,entries.map(item=>native(item.lesson_json)),langName);
    communityReset();
    // Each game still offers an optional, collapsed list of its public lessons.
    for(const card of installedCards()){
      const copy=card.querySelector('.game-copy');if(!copy)continue;
      let panel=copy.querySelector('.game-community');
      const matches=entries.filter(item=>item.game_id===card.id);
      if(!matches.length){panel?.remove();continue}
      if(!panel){panel=document.createElement('details');panel.className='game-community';copy.append(panel)}
      panel.replaceChildren();
      const summary=document.createElement('summary');summary.textContent='Community lessons · '+matches.length+' shared';panel.append(summary);
      const list=document.createElement('ul');list.className='game-community-list';
      for(const item of matches.slice(0,25)){
        const li=document.createElement('li');
        const label=document.createElement('span');
        label.textContent=languagePair(item.lesson_json)+' · '+humanLessonTitle(item);
        const play=makeButton('Play',()=>{try{window.GoLingoPlaySavedLesson?.(item.game_id,item.lesson_json)}catch(error){showError(error)}},'cloud-row-action');
        li.append(label,play,shareAction(item.id,item.title||lessonText(item.lesson_json),item.game_id));list.append(li);
      }
      panel.append(list);
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
    if(!user) { note('Sign in to publish a lesson.');return false; }
    note('Choose whether to publish this lesson…');
    const approved=await confirmInPage('Publish this lesson?',
      'Its words, sentences and translations will be visible to everyone in the GoLingo community. You can unpublish later.',
      'Publish to community');
    if(!approved)return null;
    window.GoLingoCloudLastError='';
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
      return true;
    });
    return await wrapped();
  }
  async function unpublish(gameId,lesson) {
    if (!user || publicationStatus(gameId,lesson) !== true) return;
    if(!await confirmInPage('Unpublish lesson?',
      'This lesson will disappear from the community, but remain in your private history.',
      'Unpublish')) return false;
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
      return true;
    });
    await wrapped();
  }
  window.GoLingoCloud={isSignedIn:()=>!!user,publicationStatus,publicationId,shareLesson,publish,unpublish};
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
      }else {
        window.location.assign('https://apps.apple.com/us/app/learn-lingo-with-golingo-ai/id1194977025');
      }
    }));
    signOutButton.addEventListener('click',()=>{
      window.GoLingoCognito.signOut();user=null;renderSignedIn();
      note('Signed out of game cloud. Local lessons remain on this device.');
    });
    const importLegacyButton=document.getElementById('cloud-import-legacy');
    importLegacyButton?.addEventListener('click',disableWhileRunning(async()=>{
      if(!user)return;
      if(!await confirmInPage('Import earlier lessons?',
        'Only import lessons that belong to this GoLingo account.',
        'Import my lessons'))return;
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
    note(user?'GoLingo app account connected. Cloud sync is available.':'Sign in through the GoLingo iPhone app only. Download or launch GoLingo, sign in, and open Online Games.');
    await refreshCommunity();
    // Share links work even for signed-out visitors and deep-link into the game.
    // Do not depend on Cognito or the viewer's own saved lesson history.
    await openSharedLink();
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
