// GoLingo Goal Club — local vocabulary, audio and app handoff.
// Audio and vocabulary stay on the visitor's device.
const DATA_KEY = 'golingo-goal-club.vocabulary.v1';
const REVIEW_KEY = 'golingo-goal-club.review.v1';
const LANG_TAGS = {en:'en-US',es:'es-ES',ja:'ja-JP',zh:'zh-CN',fr:'fr-FR',ko:'ko-KR',de:'de-DE',pt:'pt-BR',it:'it-IT',vi:'vi-VN',ar:'ar-SA',hi:'hi-IN',ru:'ru-RU',th:'th-TH',uk:'uk-UA'};
const DEFINITIONS = {
  es: [
    ['balón','ball','Patea el balón.','Kick the ball.'],['gol','goal','¡Qué buen gol!','What a great goal!'],
    ['equipo','team','Somos un equipo.','We are a team.'],['amigo','friend','Mi amigo juega conmigo.','My friend plays with me.'],
    ['agua','water','Quiero beber agua.','I want to drink water.'],['correr','run','Me gusta correr.','I like to run.'],
    ['saltar','jump','Puedo saltar alto.','I can jump high.'],['izquierda','left','Mira a la izquierda.','Look to the left.'],
    ['derecha','right','Mira a la derecha.','Look to the right.'],['jugar','play','Vamos a jugar.','Let’s play.'],
    ['patear','kick','Voy a patear el balón.','I am going to kick the ball.'],['ganar','win','Podemos ganar juntos.','We can win together.'],
    ['hola','hello','Hola, ¿cómo estás?','Hello, how are you?'],['gracias','thank you','Gracias por tu ayuda.','Thank you for your help.'],
    ['sol','sun','El sol brilla hoy.','The sun is shining today.'],['azul','blue','El cielo es azul.','The sky is blue.'],
    ['rojo','red','Mi camiseta es roja.','My shirt is red.'],['rápido','fast','El jugador es rápido.','The player is fast.'],
    ['bueno','good','Es un buen día.','It is a good day.'],['otra vez','again','Vamos a intentarlo otra vez.','Let’s try again.']
  ],
  ja: [
    ['ボール','ball','ボールを蹴ります。','I kick the ball.'],['ゴール','goal','すばらしいゴールです。','It is a wonderful goal.'],
    ['チーム','team','私たちは同じチームです。','We are on the same team.'],['友達','friend','友達と遊びます。','I play with my friend.'],
    ['水','water','水を飲みます。','I drink water.'],['走る','run','毎日走ります。','I run every day.'],
    ['跳ぶ','jump','高く跳びます。','I jump high.'],['左','left','左を見てください。','Please look to the left.'],
    ['右','right','右を見てください。','Please look to the right.'],['遊ぶ','play','一緒に遊びましょう。','Let’s play together.'],
    ['蹴る','kick','ボールを強く蹴ります。','I kick the ball hard.'],['勝つ','win','一緒に勝ちましょう。','Let’s win together.'],
    ['こんにちは','hello','こんにちは、お元気ですか。','Hello, how are you?'],['ありがとう','thank you','手伝ってくれてありがとう。','Thank you for helping me.'],
    ['太陽','sun','太陽が輝いています。','The sun is shining.'],['青','blue','空は青いです。','The sky is blue.'],
    ['赤','red','赤いシャツを着ています。','I am wearing a red shirt.'],['速い','fast','彼は走るのが速いです。','He is a fast runner.'],
    ['良い','good','今日は良い日です。','Today is a good day.'],['もう一度','again','もう一度やってみましょう。','Let’s try again.']
  ],
  zh: [
    ['球','ball','我把球踢进球门。','I kick the ball into the goal.'],['进球','goal','这是一个精彩的进球。','It is a wonderful goal.'],
    ['球队','team','我们在同一个球队。','We are on the same team.'],['朋友','friend','我和朋友一起玩。','I play with my friend.'],
    ['水','water','我想喝水。','I want to drink water.'],['跑步','run','我每天跑步。','I run every day.'],
    ['跳','jump','我可以跳得很高。','I can jump high.'],['左边','left','请看左边。','Please look to the left.'],
    ['右边','right','请看右边。','Please look to the right.'],['玩','play','我们一起玩吧。','Let’s play together.'],
    ['踢','kick','用脚踢球。','Kick the ball with your foot.'],['赢','win','我们可以一起赢。','We can win together.'],
    ['你好','hello','你好，你好吗？','Hello, how are you?'],['谢谢','thank you','谢谢你的帮助。','Thank you for your help.'],
    ['太阳','sun','今天太阳很明亮。','The sun is bright today.'],['蓝色','blue','天空是蓝色的。','The sky is blue.'],
    ['红色','red','我的球衣是红色的。','My jersey is red.'],['快','fast','他跑得很快。','He runs very fast.'],
    ['好','good','今天是美好的一天。','Today is a good day.'],['再来一次','again','我们再来一次吧。','Let’s try again.']
  ],
  fr: [
    ['ballon','ball','Frappe le ballon.','Kick the ball.'],['but','goal','Quel beau but !','What a great goal!'],
    ['équipe','team','Nous sommes une équipe.','We are a team.'],['ami','friend','Je joue avec mon ami.','I play with my friend.'],
    ['eau','water','Je voudrais de l’eau.','I would like some water.'],['courir','run','J’aime courir.','I like to run.'],
    ['sauter','jump','Je peux sauter haut.','I can jump high.'],['gauche','left','Regarde à gauche.','Look to the left.'],
    ['droite','right','Regarde à droite.','Look to the right.'],['jouer','play','Allons jouer ensemble.','Let’s play together.'],
    ['frapper','kick','Je vais frapper le ballon.','I am going to kick the ball.'],['gagner','win','Nous pouvons gagner ensemble.','We can win together.'],
    ['bonjour','hello','Bonjour, comment ça va ?','Hello, how are you?'],['merci','thank you','Merci pour ton aide.','Thank you for your help.'],
    ['soleil','sun','Le soleil brille.','The sun is shining.'],['bleu','blue','Le ciel est bleu.','The sky is blue.'],
    ['rouge','red','Mon maillot est rouge.','My jersey is red.'],['rapide','fast','Ce joueur est rapide.','This player is fast.'],
    ['bon','good','C’est un bon début.','It is a good start.'],['encore','again','Essayons encore.','Let’s try again.']
  ],
  ko: [
    ['공','ball','공을 차세요.','Kick the ball.'],['골','goal','멋진 골이에요!','It is a great goal!'],
    ['팀','team','우리는 같은 팀이에요.','We are on the same team.'],['친구','friend','친구와 놀아요.','I play with my friend.'],
    ['물','water','물을 마시고 싶어요.','I want to drink water.'],['달리다','run','매일 달려요.','I run every day.'],
    ['뛰다','jump','높이 뛸 수 있어요.','I can jump high.'],['왼쪽','left','왼쪽을 보세요.','Look to the left.'],
    ['오른쪽','right','오른쪽을 보세요.','Look to the right.'],['놀다','play','같이 놀아요.','Let’s play together.'],
    ['차다','kick','공을 세게 차요.','I kick the ball hard.'],['이기다','win','우리는 함께 이길 수 있어요.','We can win together.'],
    ['안녕하세요','hello','안녕하세요, 잘 지내세요?','Hello, how are you?'],['감사합니다','thank you','도와주셔서 감사합니다.','Thank you for your help.'],
    ['태양','sun','태양이 빛나요.','The sun is shining.'],['파란색','blue','하늘은 파란색이에요.','The sky is blue.'],
    ['빨간색','red','제 유니폼은 빨간색이에요.','My uniform is red.'],['빠르다','fast','그 선수는 빨라요.','That player is fast.'],
    ['좋다','good','오늘은 좋은 날이에요.','Today is a good day.'],['다시','again','다시 해 봐요.','Let’s try again.']
  ],
  de: [
    ['Ball','ball','Schieß den Ball.','Kick the ball.'],['Tor','goal','Was für ein tolles Tor!','What a great goal!'],
    ['Mannschaft','team','Wir sind eine Mannschaft.','We are a team.'],['Freund','friend','Ich spiele mit meinem Freund.','I play with my friend.'],
    ['Wasser','water','Ich möchte Wasser trinken.','I want to drink water.'],['laufen','run','Ich laufe jeden Tag.','I run every day.'],
    ['springen','jump','Ich kann hoch springen.','I can jump high.'],['links','left','Schau nach links.','Look to the left.'],
    ['rechts','right','Schau nach rechts.','Look to the right.'],['spielen','play','Lass uns zusammen spielen.','Let’s play together.'],
    ['schießen','kick','Ich schieße den Ball.','I kick the ball.'],['gewinnen','win','Wir können zusammen gewinnen.','We can win together.'],
    ['hallo','hello','Hallo, wie geht es dir?','Hello, how are you?'],['danke','thank you','Danke für deine Hilfe.','Thank you for your help.'],
    ['Sonne','sun','Die Sonne scheint.','The sun is shining.'],['blau','blue','Der Himmel ist blau.','The sky is blue.'],
    ['rot','red','Mein Trikot ist rot.','My jersey is red.'],['schnell','fast','Dieser Spieler ist schnell.','This player is fast.'],
    ['gut','good','Heute ist ein guter Tag.','Today is a good day.'],['noch einmal','again','Versuchen wir es noch einmal.','Let’s try again.']
  ]
};

const readStorage = key => { try { return localStorage.getItem(key); } catch { return null; } };
const writeStorage = (key,value) => { try { localStorage.setItem(key,JSON.stringify(value)); } catch { /* Private browsing / full storage. */ } };
const clean = (value,max=1500) => typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0,max) : '';
const language = value => clean(value,40) || 'en';
const baseLanguage = value => language(value).toLowerCase().split(/[-_]/)[0];
const audioURL = value => {
  const candidate = clean(value,10000);
  if (!candidate || /^(?:javascript|vbscript):/i.test(candidate)) return '';
  if (/^data:/i.test(candidate) && !/^data:audio\//i.test(candidate)) return '';
  try { const u=new URL(candidate,location.href); return ['http:','https:','blob:','data:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
};
const first = (...values) => values.find(v => typeof v==='string' || typeof v==='number') ?? '';
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function decodeCandidate(input) {
  if (typeof input !== 'string') return input;
  if (input.length > 12 * 1024 * 1024) throw new Error('This word list is too large. Please use a smaller JSON file.');
  let text=input.trim();
  const seen=new Set();
  for (let i=0;i<4;i++) {
    if (!text || seen.has(text)) break;
    seen.add(text);
    try { return JSON.parse(text); } catch {}
    try { const decoded=decodeURIComponent(text); if(decoded!==text){text=decoded;continue;} } catch {}
    try {
      const normalized=text.replace(/^base64[:,]/i,'').replace(/-/g,'+').replace(/_/g,'/');
      const bytes=Uint8Array.from(atob(normalized),c=>c.charCodeAt(0));
      const decoded=new TextDecoder().decode(bytes);
      if (decoded!==text) {text=decoded;continue;}
    } catch {}
    break;
  }
  throw new Error('Please choose a JSON word list with a words array.');
}

function normalize(input, fallback={primaryLanguage:'en',learningLanguage:'es'}) {
  let data=decodeCandidate(input);
  for(let i=0;i<4;i++) {
    if(Array.isArray(data) || (isRecord(data) && (Array.isArray(data.words)||Array.isArray(data.sentences)||Array.isArray(data.items)))) break;
    if(isRecord(data) && (data.data!==undefined || data.payload!==undefined || data.vocabulary!==undefined)) data=decodeCandidate(data.data??data.payload??data.vocabulary);
    else break;
  }
  const rows=Array.isArray(data)?data:data?.words??data?.sentences??data?.items;
  if(!Array.isArray(rows)) throw new Error('This file needs a words array.');
  if(rows.length>10000) throw new Error('Please import 10,000 words or fewer at a time.');
  const words=rows.map((entry,index)=>{
    const row=typeof entry==='string'?{word:entry}:entry;
    if(!isRecord(row)) return null;
    const word=clean(first(row.word,row.text,row.learningText,row.target,row.sentence));
    if(!word) return null;
    return {
      id:clean(first(row.id,`word-${index+1}`),160),word,
      translation:clean(first(row.translation,row.meaning,row.primaryText,row.wordTranslation,row.sentenceTranslation)),
      sentence:clean(first(row.sentence,row.example,row.exampleSentence),3000),
      sentenceTranslation:clean(first(row.sentenceTranslation,row.exampleTranslation),3000),
      audioUrl:audioURL(first(row.audioUrl,row.audioURL,row.wordAudioUrl,row.wordAudioURL,row.audio,row.soundUrl,row.soundURL)),
      sentenceAudioUrl:audioURL(first(row.sentenceAudioUrl,row.sentenceAudioURL,row.exampleAudioUrl)),
      translationAudioUrl:audioURL(first(row.translationAudioUrl,row.translationAudioURL,row.meaningAudioUrl))
    };
  }).filter(Boolean);
  if(!words.length) throw new Error('No words were found in this list.');
  return {
    primaryLanguage:language(Array.isArray(data)?fallback.primaryLanguage:data.primaryLanguage??data.primaryLanguageCode??data.sourceLanguage??fallback.primaryLanguage),
    learningLanguage:language(Array.isArray(data)?fallback.learningLanguage:data.learningLanguage??data.learningLanguageCode??data.targetLanguage??fallback.learningLanguage),
    words
  };
}

function builtIn(code='es') {
  const key=baseLanguage(code);
  const selected=DEFINITIONS[key] ? key : 'es';
  return normalize({primaryLanguage:'en',learningLanguage:selected,words:DEFINITIONS[selected].map(([word,translation,sentence,sentenceTranslation],i)=>({id:`${selected}-${i+1}`,word,translation,sentence,sentenceTranslation}))});
}

export function createLearning({onData=()=>{},onStatus=()=>{}}={}) {
  let dataset=builtIn('es');
  let muted=false,paused=false,repeatEnabled=true,unlocked=false,desired=null;
  let epoch=0,timer=null,watchdog=null,audio=null,disposed=false,readyDone=false;
  let reviews=[];
  try { const cached=JSON.parse(readStorage(REVIEW_KEY)||'[]'); if(Array.isArray(cached)) reviews=cached.filter(isRecord).slice(-10000); } catch {}
  const status=message=>{try{onStatus(message);}catch{}};
  const notify=source=>{try{onData(dataset,{source});}catch{}};
  const languageTag=code=>LANG_TAGS[baseLanguage(code)] || language(code);

  // A completion belongs to one request, not to each repeat of that request.
  // It always resolves, so gameplay can safely wait for a lesson to finish.
  function settle(request,playbackStatus,reason) {
    const completion=request?.completion;
    if(!completion || completion.done)return;
    completion.done=true;
    const result=reason?{status:playbackStatus,reason}:{status:playbackStatus};
    completion.resolve(result);
    if(typeof completion.onComplete==='function')Promise.resolve().then(()=>completion.onComplete(result)).catch(()=>{});
  }
  function completed(token) {
    if(!active(token))return;
    settle(desired,'completed');schedule(token);
  }
  function failed(request,token,reason) {
    if(!active(token))return;
    clearTimeout(watchdog);watchdog=null;
    settle(request,'failed',reason);
  }

  function cancelPlayback() {
    epoch++;
    clearTimeout(timer);clearTimeout(watchdog);timer=null;watchdog=null;
    if(audio) {audio.onended=null;audio.onerror=null;audio.oncanplay=null;audio.onplaying=null;audio.ontimeupdate=null;try{audio.pause();audio.currentTime=0;}catch{}}
    if('speechSynthesis' in window) {try{speechSynthesis.cancel();}catch{}}
  }
  function stop(){settle(desired,'stopped','stopped');desired=null;cancelPlayback();}
  function active(token){return token===epoch && !disposed && unlocked && !muted && !paused;}
  function schedule(token) {
    clearTimeout(watchdog);watchdog=null;
    if(!active(token)||!desired?.repeat||!repeatEnabled) return;
    timer=setTimeout(()=>{timer=null;if(active(token))playDesired();},1500);
  }
  function speakFallback(request,token) {
    if(!active(token))return;
    if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {status('Speech is unavailable in this browser. Imported audio can still play.');settle(request,'noaudio','speech-unavailable');return;}
    const text=request.text;
    if(!text){settle(request,'noaudio','empty');return;}
    let utterance,voices;
    try {utterance=new SpeechSynthesisUtterance(text);voices=speechSynthesis.getVoices();}
    catch {failed(request,token,'speech-unavailable');return;}
    utterance.lang=languageTag(request.lang);utterance.rate=.86;utterance.pitch=1;utterance.volume=1;
    const exact=voices.find(v=>v.lang.toLowerCase()===utterance.lang.toLowerCase());
    const match=exact || voices.find(v=>baseLanguage(v.lang)===baseLanguage(request.lang));
    if(match)utterance.voice=match;
    let finished=false;
    const timedOut=()=>{
      if(finished||!active(token))return;finished=true;
      failed(request,token,'speech-timeout');try{speechSynthesis.cancel();}catch{}
    };
    // A silent browser failure cannot leave a completion pending forever.
    // After speech starts, the allowance scales with text length rather than
    // clipping longer imported sentences to a fixed lesson duration.
    watchdog=setTimeout(timedOut,15000);
    utterance.onstart=()=>{if(!active(token)||finished)return;clearTimeout(watchdog);watchdog=setTimeout(timedOut,Math.max(30000,text.length*350+15000));};
    utterance.onend=()=>{if(finished)return;finished=true;completed(token);};
    utterance.onerror=event=>{
      if(finished || !active(token))return;finished=true;
      if(['interrupted','canceled','cancelled'].includes(event.error)){clearTimeout(watchdog);watchdog=null;settle(request,'stopped',event.error);}
      else {status('The voice could not play. Tap ▶ to retry, or import word audio.');failed(request,token,event.error||'speech-error');}
    };
    try {speechSynthesis.resume();speechSynthesis.speak(utterance);}catch {status('Tap Listen to enable the voice on your device.');failed(request,token,'speech-error');}
  }
  function playDesired() {
    if(!desired||disposed||muted||paused||!unlocked)return;
    cancelPlayback();
    const token=epoch,request={...desired};
    if(!request.url){speakFallback(request,token);return;}
    if(!audio)audio=new Audio();
    audio.preload='auto';audio.volume=1;
    let fellBack=false,lastPlaybackTime=-1;
    const fallback=()=>{if(fellBack||!active(token))return;fellBack=true;clearTimeout(watchdog);audio.onended=null;audio.onerror=null;audio.oncanplay=null;audio.onplaying=null;audio.ontimeupdate=null;try{audio.pause();}catch{}speakFallback(request,token);};
    audio.onended=()=>{if(!fellBack)completed(token);};
    audio.onerror=fallback;
    audio.src=request.url;
    watchdog=setTimeout(fallback,15000);
    const monitorProgress=()=>{if(active(token)&&!fellBack){clearTimeout(watchdog);watchdog=setTimeout(fallback,25000);}};
    audio.oncanplay=monitorProgress;audio.onplaying=monitorProgress;
    audio.ontimeupdate=()=>{if(audio.currentTime>lastPlaybackTime+.01){lastPlaybackTime=audio.currentTime;monitorProgress();}};
    try {const promise=audio.play();if(promise?.catch)promise.catch(fallback);}catch{fallback();}
  }
  function requestSpeech(text,lang,url,repeat=false,onComplete) {
    settle(desired,'stopped','replaced');cancelPlayback();
    let resolve;const promise=new Promise(done=>{resolve=done;});
    desired={text:clean(text,3000),lang,url:audioURL(url),repeat,completion:{resolve,onComplete,done:false}};
    if(disposed)settle(desired,'stopped','disposed');
    else if(muted||paused)settle(desired,'stopped',muted?'muted':'paused');
    else if(!unlocked)settle(desired,'noaudio','locked');
    else if(!desired.text&&!desired.url)settle(desired,'noaudio','empty');
    else playDesired();
    return promise;
  }
  function unlock() {
    if(disposed)return;
    const firstUnlock=!unlocked;unlocked=true;
    if(!audio)audio=new Audio();
    if(firstUnlock && 'speechSynthesis' in window){
      try {
        speechSynthesis.resume();
        if(!desired){const silent=new SpeechSynthesisUtterance(' ');silent.volume=0;speechSynthesis.speak(silent);}
      }catch{}
    }
    if(desired && !muted && !paused)playDesired();
  }
  function setMuted(value){muted=!!value;if(muted)settle(desired,'stopped','muted');cancelPlayback();if(!muted)playDesired();}
  function setPaused(value){paused=!!value;if(paused)settle(desired,'stopped','paused');cancelPlayback();if(!paused)playDesired();}
  function setRepeat(value){repeatEnabled=!!value;clearTimeout(timer);timer=null;if(repeatEnabled && desired?.repeat)playDesired();}
  function speakWord(entry,{repeat=true}={}) { if(entry)requestSpeech(entry.word,dataset.learningLanguage,entry.audioUrl??entry.audioURL,repeat); }
  function speakMeaning(entry,{repeat=false}={}) { if(entry)requestSpeech(entry.translation,dataset.primaryLanguage,entry.translationAudioUrl,repeat); }
  function speakSentence(entry,{repeat=false,onComplete}={}) {
    if(entry)return requestSpeech(entry.sentence||entry.word,dataset.learningLanguage,entry.sentence?entry.sentenceAudioUrl:entry.audioUrl,repeat,onComplete);
    const result={status:'noaudio',reason:'empty'};
    if(typeof onComplete==='function')Promise.resolve().then(()=>onComplete(result)).catch(()=>{});
    return Promise.resolve(result);
  }

  function load(input,{source='import',persist=true}={}) {
    const normalized=normalize(input,dataset);
    stop();dataset=normalized;
    if(persist)writeStorage(DATA_KEY,dataset);
    notify(source);return dataset;
  }
  function useLanguage(code){return load(builtIn(code),{source:'language'});}
  function current(index=0){return dataset.words[((Math.trunc(Number(index)||0)%dataset.words.length)+dataset.words.length)%dataset.words.length];}
  function options(index=0,count=3) {
    const correct=current(index),pool=dataset.words.filter(entry=>entry.word!==correct.word);
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const unique=[],seen=new Set([correct.word]);
    for(const entry of pool){if(!seen.has(entry.word)){unique.push(entry);seen.add(entry.word);}}
    const result=[correct,...unique.slice(0,Math.max(0,Math.min(10,count)-1))];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  async function importFile(file){
    if(!file || typeof file.text!=='function')throw new Error('Please choose a JSON word list.');
    if(file.size>12*1024*1024)throw new Error('Please choose a JSON file smaller than 12 MB.');
    return load(await file.text(),{source:'file'});
  }
  function getExport(){return JSON.parse(JSON.stringify(dataset));}
  function review(entry) {
    if(!entry?.word)return;
    const key=`${dataset.learningLanguage}\u0000${entry.word}\u0000${entry.translation||''}`;
    const old=reviews.find(row=>row.key===key);
    if(old){old.count=(Number(old.count)||0)+1;old.reviewedAt=new Date().toISOString();}
    else reviews.push({...entry,key,count:1,primaryLanguage:dataset.primaryLanguage,learningLanguage:dataset.learningLanguage,reviewedAt:new Date().toISOString()});
    reviews=reviews.slice(-10000);writeStorage(REVIEW_KEY,reviews);
  }
  function getReview(){return reviews.filter(row=>row.learningLanguage===dataset.learningLanguage).map(row=>({...row}));}
  function exportReview() {
    const words=getReview().map(({key,count,reviewedAt,primaryLanguage,learningLanguage,...entry})=>entry);
    const payload={primaryLanguage:dataset.primaryLanguage,learningLanguage:dataset.learningLanguage,words};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=`golingo-goal-club-${dataset.learningLanguage}-review.json`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);return payload;
  }
  function allowedMessage(event) {
    if(event.origin===location.origin)return true;
    if((event.origin==='null'||!event.origin) && (event.source===window || event.source===null))return true;
    try {const host=new URL(event.origin).hostname;return host==='golingoapp.com'||host.endsWith('.golingoapp.com')||host==='xcergolingo.github.io'||host.endsWith('.chatgpt.site');}catch{return false;}
  }
  function onMessage(event) {
    if(!allowedMessage(event))return;
    const data=event.data;
    if(!isRecord(data) && !Array.isArray(data))return;
    if(isRecord(data) && data.type && !['GOLINGO_DATA','GOLINGO_WORDS','golingo-data','golingoData','loadWords','setWords','LOAD_WORDS'].includes(data.type))return;
    if(isRecord(data) && !data.words && !data.sentences && !data.items && !data.data && !data.payload && !data.vocabulary)return;
    try{load(data,{source:'app'});status(`${dataset.words.length} words received from GoLingo.`);}catch(error){status(error.message);}
  }
  function announce() {
    const message={type:'GOLINGO_READY',game:'golingo-goal-club',accepts:'words',version:1};
    try{if(window.parent!==window)window.parent.postMessage(message,'*');}catch{}
    try{if(window.opener)window.opener.postMessage(message,'*');}catch{}
    // WKWebView hosts can opt in to either conventional message handler.
    try{const handlers=window.webkit?.messageHandlers;const handler=handlers?.golingo||handlers?.gameReady;if(handler)handler.postMessage(message);}catch{}
  }
  async function ready() {
    if(readyDone)return dataset;readyDone=true;
    window.addEventListener('message',onMessage);
    window.receiveGoLingoData=input=>load(input,{source:'app'});
    window.setGoLingoData=window.receiveGoLingoData;
    let loaded=false;
    const candidates=[];
    const search=new URLSearchParams(location.search);
    for(const name of ['data','words','payload','golingo','vocabulary']){const value=search.get(name);if(value)candidates.push({value,source:'url'});}
    if(location.hash.length>1){const hash=location.hash.slice(1),hashParams=new URLSearchParams(hash);let found=false;for(const name of ['data','words','payload','golingo']){const value=hashParams.get(name);if(value){candidates.push({value,source:'url'});found=true;}}if(!found && !/^[a-z-]+$/i.test(hash))candidates.push({value:hash,source:'url'});}
    for(const name of ['GOLINGO_DATA','golingoData','goLingoData'])if(window[name])candidates.push({value:window[name],source:'app'});
    for(const key of ['golingo-game-data','golingoData','golingo-data','golingoPayload','golingo_payload','golingoWords','golingo_words',DATA_KEY]){const value=readStorage(key);if(value)candidates.push({value,source:'saved'});}
    for(const candidate of candidates){try{load(candidate.value,{source:candidate.source});loaded=true;break;}catch(error){if(candidate.source==='url')status(error.message);}}
    if(!loaded){const code=search.get('learningLanguage')||search.get('lang');if(code && DEFINITIONS[baseLanguage(code)])dataset=builtIn(code);notify('default');}
    announce();return dataset;
  }
  function dispose(){disposed=true;stop();window.removeEventListener('message',onMessage);}
  return {get dataset(){return dataset;},get muted(){return muted;},get paused(){return paused;},get repeat(){return repeatEnabled;},ready,load,useLanguage,current,options,speakWord,speakMeaning,speakSentence,unlock,stop,setMuted,setRepeat,setPaused,importFile,getExport,review,getReview,exportReview,dispose};
}
