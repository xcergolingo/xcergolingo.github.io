/* GoLingo lessons, bounded speech playback and collected-word review. No renderer dependency. */
const W = typeof window === 'object' ? window : globalThis;
const STORE = 'sky-reach-golingo-v1';
const MAX_ENTRIES = 50000;
const MAX_INPUT_BYTES = 32 * 1024 * 1024;
const LIST_KEYS = ['words', 'sentences', 'phrases', 'items', 'entries', 'vocabulary', 'list'];
const MESSAGE_TYPES = new Set(['golingo_data', 'golingo-data', 'golingo.lesson', 'golingo:lesson', 'golingo:importwords', 'golingo_lesson', 'golingo-content', 'loadsentences', 'golingo_words', 'setgolingodata', 'receivegolingodata']);
const LANG_NAMES = { english:'en', spanish:'es', 'español':'es', japanese:'ja', '日本語':'ja', chinese:'zh-CN', mandarin:'zh-CN', '中文':'zh-CN', '汉语':'zh-CN', 'simplified chinese':'zh-CN', 'traditional chinese':'zh-TW', french:'fr', 'français':'fr', german:'de', deutsch:'de', italian:'it', portuguese:'pt', 'português':'pt', korean:'ko', vietnamese:'vi', russian:'ru', arabic:'ar', hindi:'hi', thai:'th', ukrainian:'uk' };
const DEFAULT_SETTINGS = Object.freeze({ enabled:true, mode:'learn', practice:'words', speech:true, repeat:true, repeatGap:4.5, showWord:true, showTranslation:true, showMarkers:true, speakTranslation:false, sentences:true, rate:.85, voiceURI:'' });
const DEMOS = {
  es: [
    ['el cielo','the sky','El cielo está azul.','The sky is blue.'],
    ['la estrella','the star','La estrella brilla.','The star shines.'],
    ['el mundo','the world','Exploramos un mundo nuevo.','We explore a new world.'],
    ['la nave','the spacecraft','La nave despega.','The spacecraft takes off.'],
    ['el ala','the wing','El ala es blanca.','The wing is white.'],
    ['el viento','the wind','El viento sopla.','The wind blows.'],
    ['la montaña','the mountain','Veo la montaña.','I see the mountain.'],
    ['el río','the river','Cruzamos el río.','We cross the river.'],
    ['el bosque','the forest','Caminamos por el bosque.','We walk through the forest.'],
    ['la luz','the light','Veo una luz.','I see a light.'],
    ['el cristal','the crystal','Recojo un cristal.','I collect a crystal.'],
    ['el puente','the bridge','Cruzamos el puente.','We cross the bridge.'],
    ['arriba','up','Mira hacia arriba.','Look up.'],
    ['abajo','down','Mira hacia abajo.','Look down.'],
    ['a la izquierda','to the left','Gira a la izquierda.','Turn left.'],
    ['a la derecha','to the right','Gira a la derecha.','Turn right.'],
    ['volar','to fly','Me gusta volar.','I like to fly.'],
    ['explorar','to explore','Vamos a explorar.','Let us explore.'],
  ],
  ja: [
    ['空','sky','空は青いです。','The sky is blue.'],
    ['星','star','星が光っています。','The star is shining.'],
    ['世界','world','新しい世界を探検します。','We explore a new world.'],
    ['宇宙船','spacecraft','宇宙船に乗ります。','I board the spacecraft.'],
    ['翼','wing','翼が大きいです。','The wing is large.'],
    ['風','wind','風が吹いています。','The wind is blowing.'],
    ['山','mountain','山が見えます。','I can see the mountain.'],
    ['川','river','川を渡ります。','We cross the river.'],
    ['森','forest','森を歩きます。','We walk through the forest.'],
    ['光','light','光が見えます。','I can see a light.'],
    ['水晶','crystal','水晶を集めます。','I collect crystals.'],
    ['橋','bridge','橋を渡ります。','We cross the bridge.'],
  ],
  'zh-CN': [
    ['天空','sky','天空很蓝。','The sky is blue.'],
    ['星星','star','星星在闪烁。','The stars are twinkling.'],
    ['世界','world','我们探索新的世界。','We explore a new world.'],
    ['飞船','spacecraft','飞船正在起飞。','The spacecraft is taking off.'],
    ['翅膀','wing','鸟有翅膀。','Birds have wings.'],
    ['风','wind','风在吹。','The wind is blowing.'],
    ['山','mountain','远处有一座山。','There is a mountain in the distance.'],
    ['河流','river','河流穿过森林。','The river flows through the forest.'],
    ['森林','forest','我们走进森林。','We walk into the forest.'],
    ['光','light','我看见一道光。','I see a beam of light.'],
    ['水晶','crystal','我收集发光的水晶。','I collect glowing crystals.'],
    ['桥','bridge','我们走过这座桥。','We walk across this bridge.'],
  ],
  fr: [
    ['le ciel','the sky','Le ciel est bleu.','The sky is blue.'],
    ["l’étoile",'the star',"L’étoile brille.",'The star shines.'],
    ['le monde','the world','Nous explorons un nouveau monde.','We explore a new world.'],
    ['le vaisseau','the spacecraft','Le vaisseau décolle.','The spacecraft takes off.'],
    ["l’aile",'the wing',"L’aile est blanche.",'The wing is white.'],
    ['le vent','the wind','Le vent souffle.','The wind blows.'],
    ['la montagne','the mountain','Je vois la montagne.','I see the mountain.'],
    ['la rivière','the river','Nous traversons la rivière.','We cross the river.'],
    ['la forêt','the forest','Nous marchons dans la forêt.','We walk in the forest.'],
    ['la lumière','the light','Je vois une lumière.','I see a light.'],
    ['le cristal','the crystal','Je ramasse un cristal.','I collect a crystal.'],
    ['le pont','the bridge','Nous traversons le pont.','We cross the bridge.'],
  ],
  de: [
    ['der Himmel','the sky','Der Himmel ist blau.','The sky is blue.'],
    ['der Stern','the star','Der Stern leuchtet.','The star shines.'],
    ['die Welt','the world','Wir erkunden eine neue Welt.','We explore a new world.'],
    ['das Raumschiff','the spacecraft','Das Raumschiff startet.','The spacecraft takes off.'],
    ['der Flügel','the wing','Der Flügel ist weiß.','The wing is white.'],
    ['der Wind','the wind','Der Wind weht.','The wind blows.'],
    ['der Berg','the mountain','Ich sehe den Berg.','I see the mountain.'],
    ['der Fluss','the river','Wir überqueren den Fluss.','We cross the river.'],
    ['der Wald','the forest','Wir gehen durch den Wald.','We walk through the forest.'],
    ['das Licht','the light','Ich sehe ein Licht.','I see a light.'],
    ['der Kristall','the crystal','Ich sammle einen Kristall.','I collect a crystal.'],
    ['die Brücke','the bridge','Wir überqueren die Brücke.','We cross the bridge.'],
  ],
};

function cleanText(value) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
function firstText(...values) { for(const value of values){const text=cleanText(value);if(text)return text;}return ''; }
function language(value, fallback='en') {
  if (value && typeof value === 'object') value=value.code??value.languageCode??value.value??value.name;
  let code=cleanText(value).replace(/_/g,'-');code=LANG_NAMES[code.toLowerCase()]||code;
  if (!/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(code)) return fallback;
  try { return Intl.getCanonicalLocales(code)[0]||fallback; } catch { return fallback; }
}
function safeAudio(value) {
  if (value && typeof value==='object') value=value.url??value.src;
  const text=cleanText(value);if(!text)return '';
  if (/^data:audio\//i.test(text)||/^blob:/i.test(text)) return text;
  try { const url=new URL(text,W.location?.href||'https://xcergolingo.github.io/');return /^(https?:)$/.test(url.protocol)?url.href:''; }catch{return '';}
}
function firstAudio(...values) { for(const value of values){const url=safeAudio(value);if(url)return url;}return ''; }
function storage(kind='localStorage') { try { return W[kind]||(typeof globalThis==='object'?globalThis[kind]:null)||null; }catch{return null;} }
function readSaved(key) { try { return JSON.parse(storage()?.getItem(key)||'null'); }catch{return null;} }
function cloneEntry(entry) { return entry?JSON.parse(JSON.stringify(entry)):null; }
function entryData(entry) {
  try { return JSON.parse(JSON.stringify(entry)); }
  catch { throw new Error('An entry contains circular or unsupported data. Import ordinary JSON fields.'); }
}
function freezeData(value) {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freezeData(child);}
  return value;
}
const keyFor=e=>`${e.learningLanguage||''}\u0000${e.word}\u0000${e.translation}\u0000${e.sentence||''}`;
const choiceKey=text=>cleanText(text).normalize('NFKC').toLocaleLowerCase();

function csvRows(text, delimiter) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export function parseLessonText(text) {
  text=String(text??'').replace(/^\uFEFF/,'').trim();
  if(!text)throw new Error('Paste some words or a GoLingo JSON lesson first.');
  if(text.length>MAX_INPUT_BYTES)throw new Error('This lesson exceeds the 32 MB import limit. Split it into smaller lessons.');
  const candidates=[text];try{const decoded=decodeURIComponent(text);if(decoded!==text)candidates.push(decoded);}catch{}
  for(const candidate of candidates){try{return JSON.parse(candidate);}catch{}}
  if(/^[\[{]/.test(candidates.at(-1)))throw new Error('The lesson JSON is not valid. Check its commas, quotes, and brackets.');
  if(/^[A-Za-z0-9+/_=-]+$/.test(text)&&text.length>16&&typeof W.atob==='function'){
    try{const decoded=W.atob(text.replace(/-/g,'+').replace(/_/g,'/'));const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));}catch{}
  }
  const first=text.split(/\r?\n/,1)[0];const delimiter=first.includes('\t')?'\t':!first.includes('=')&&first.includes(',')?',':null;
  if(delimiter){
    const rows=csvRows(text,delimiter),headers=rows[0].map(x=>x.trim().toLowerCase());
    const isHeader=headers.some(x=>['word','term','text','sentence','phrase'].includes(x))&&headers.some(x=>['translation','meaning','definition','sentencetranslation'].includes(x));
    const fields={id:'id',word:'word',term:'word',text:'word',phrase:'word',translation:'translation',meaning:'translation',definition:'translation',sentence:'sentence',sentencetranslation:'sentenceTranslation',language:'language',audiourl:'audioUrl',sentenceaudiourl:'sentenceAudioUrl'};
    return {words:(isHeader?rows.slice(1):rows).map(row=>{
      if(!isHeader)return{word:row[0]||'',translation:row[1]||'',sentence:row[2]||'',sentenceTranslation:row[3]||''};
      const item={};headers.forEach((h,i)=>{if(fields[h])item[fields[h]]=row[i]||''});return item;
    })};
  }
  return{words:text.split(/\r?\n/).map(line=>{const at=line.indexOf('=');if(at>=0)return{word:line.slice(0,at).trim(),translation:line.slice(at+1).trim()};const split=line.indexOf(' — ');return split>=0?{word:line.slice(0,split),translation:line.slice(split+3)}:{word:line.trim()};}).filter(e=>e.word)};
}

export function normalizeLesson(input, fallback={primaryLanguage:'en',learningLanguage:'es'}) {
  let value=input,meta={};
  for(let depth=0;depth<9;depth++){
    if(typeof value==='string'){value=parseLessonText(value);continue;}
    if(Array.isArray(value)){value={words:value};break;}
    if(!value||typeof value!=='object')throw new Error('Use a GoLingo lesson object, a word list, or word = meaning lines.');
    for(const key of ['primaryLanguage','translationLanguage','primaryLang','sourceLanguage','baseLanguage','learningLanguage','learningLang','targetLanguage','language','title'])if(value[key]!=null)meta[key]=value[key];
    if(LIST_KEYS.some(key=>Array.isArray(value[key])))break;
    const nested=value.lesson??value.payload??value.data??value.golingoData??value.gameData??value.content;
    if(nested===undefined||nested===value)throw new Error('Include a nonempty words, sentences, phrases, items, or entries list.');
    value=nested;
  }
  if(Array.isArray(value))value={words:value};
  if(!value||typeof value!=='object'||!LIST_KEYS.some(k=>Array.isArray(value[k])))throw new Error('No word or sentence list was found in this lesson.');
  meta={...meta,...value};
  const learningLanguage=language(meta.learningLanguage??meta.learningLang??meta.targetLanguage??meta.language,fallback.learningLanguage||'es');
  const primaryLanguage=language(meta.primaryLanguage??meta.translationLanguage??meta.primaryLang??meta.sourceLanguage??meta.baseLanguage,fallback.primaryLanguage||'en');
  const total=LIST_KEYS.reduce((n,k)=>n+(Array.isArray(value[k])?value[k].length:0),0);
  if(total>MAX_ENTRIES)throw new Error(`This lesson has ${total.toLocaleString()} entries. The limit is ${MAX_ENTRIES.toLocaleString()}; split it rather than losing any words.`);
  const words=[],seen=new Set();let invalid=0;
  for(const listKey of LIST_KEYS){
    for(const raw of Array.isArray(value[listKey])?value[listKey]:[]){
      const e=typeof raw==='string'||typeof raw==='number'?{word:String(raw)}:raw;
      if(!e||typeof e!=='object'||Array.isArray(e)){invalid++;continue;}
      const sentenceOnly=listKey==='sentences';
      const word=sentenceOnly?firstText(e.sentence,e.phrase,e.text,e.word,e.term):firstText(e.word,e.term,e.learningText,e.phrase,e.text,e.sentence);
      if(!word){invalid++;continue;}
      const sourceLang=language(e.learningLanguage??e.language,learningLanguage),primaryLang=language(e.primaryLanguage??e.translationLanguage,primaryLanguage);
      const translations={};if(e.translations&&typeof e.translations==='object'&&!Array.isArray(e.translations))for(const [k,v]of Object.entries(e.translations)){if(typeof v==='string')translations[k]=v;}
      const translation=firstText(sentenceOnly?e.sentenceTranslation:undefined,e.translation,e.meaning,e.definition,e.primaryText,e.wordTranslation,e.phraseTranslation,e.sentenceTranslation,translations[primaryLang],translations[primaryLang.split('-')[0]]);
      const item={...entryData(e),id:typeof e.id==='string'||(typeof e.id==='number'&&Number.isFinite(e.id))?e.id:`item-${words.length+1}`,word,translation,
        sentence:firstText(e.sentence,e.exampleSentence,sentenceOnly?word:''),
        sentenceTranslation:firstText(e.sentenceTranslation,e.exampleTranslation,sentenceOnly?translation:''),
        learningLanguage:sourceLang,primaryLanguage:primaryLang};
      if(e.language!=null)item.language=sourceLang;if(e.translationLanguage!=null)item.translationLanguage=primaryLang;
      const sentenceAudio=firstAudio(e.sentenceAudioUrl,e.sentenceAudioURL,e.sentenceAudio,e.exampleAudioUrl);
      const audio=firstAudio(sentenceOnly?sentenceAudio:undefined,e.audioUrl,e.audioURL,e.wordAudioUrl,e.wordAudioURL,e.audio);
      const translationAudio=firstAudio(e.translationAudioUrl,e.translationAudioURL,e.translationAudio);
      const sentenceTranslationAudio=firstAudio(e.sentenceTranslationAudioUrl,e.sentenceTranslationAudio);
      for(const key of ['audioUrl','sentenceAudioUrl','translationAudioUrl','sentenceTranslationAudioUrl'])delete item[key];
      if(audio)item.audioUrl=audio;if(sentenceAudio)item.sentenceAudioUrl=sentenceAudio;if(translationAudio)item.translationAudioUrl=translationAudio;if(sentenceTranslationAudio)item.sentenceTranslationAudioUrl=sentenceTranslationAudio;
      if(Object.keys(translations).length)item.translations=Object.freeze(translations);
      for(const key of ['lessonKey','place'])if(typeof e[key]==='string')item[key]=e[key];
      const key=keyFor(item);if(seen.has(key))continue;seen.add(key);words.push(freezeData(item));
    }
  }
  if(!words.length)throw new Error('The lesson contains no readable words or sentences.');
  return{primaryLanguage,learningLanguage,words,...(cleanText(meta.title)?{title:cleanText(meta.title)}:{}),invalidEntries:invalid};
}
function demoLesson(code='es') {
  const canonical=language(code,'es'),selected=DEMOS[canonical]?canonical:canonical.startsWith('zh')?'zh-CN':canonical.split('-')[0];
  if(!DEMOS[selected])throw new Error('Choose a built-in Spanish, Japanese, Chinese, French, or German lesson, or import your own.');
  return{primaryLanguage:'en',learningLanguage:selected,words:DEMOS[selected].map(([word,translation,sentence,sentenceTranslation],i)=>({id:`sky-${selected}-${i+1}`,word,translation,sentence,sentenceTranslation}))};
}
function fingerprint(lesson) {let h=2166136261;for(const part of [lesson.primaryLanguage,lesson.learningLanguage,...lesson.words.map(e=>keyFor(e))])for(let i=0;i<part.length;i++){h^=part.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}

export class LearningController {
  constructor({restore=true,installBridge=false}={}) {
    this.settings={...DEFAULT_SETTINGS};this.lesson=normalizeLesson(demoLesson());this.lessonSource='demo';this.index=0;this.stats={correct:0,attempts:0,streak:0,studied:0};this.basket=new Map();this.listeners=new Set();this.revision=0;this.questionSequence=0;this.notice='';this.audioStatus='Tap Launch or Listen to enable pronunciation.';
    this._running=false;this._unlocked=false;this._now=0;this._nextRepeat=0;this._wrongUntil=0;this._audioRun=0;this._audioBusy=false;this._audioFailed=false;this._audio=null;this._utterance=null;this._watchdog=null;this._pendingPrompt=null;this._failedAudioUrls=new Set();this._bridgeInstalled=false;
    if(restore){
      const settings=readSaved(STORE+'.settings');if(settings)this._applySettings(settings);
      const saved=readSaved(STORE+'.lesson');if(saved?.words)try{this.lesson=normalizeLesson(saved);this.lessonSource=saved.source==='demo'?'demo':'saved';}catch{}
    }
    this.lessonFingerprint=fingerprint(this.lesson);
    if(restore){const progress=readSaved(STORE+'.progress');if(progress?.lessonFingerprint===this.lessonFingerprint){this.index=Math.max(0,Math.floor(Number(progress.index)||0))%this.lesson.words.length;for(const k of Object.keys(this.stats))this.stats[k]=Math.max(0,Math.floor(Number(progress.stats?.[k])||0));if(Array.isArray(progress.words)){try{for(const e of normalizeLesson({...this.lesson,words:progress.words}).words)this.basket.set(keyFor(e),e);}catch{}}}}
    this.displayEntry=this.lesson.words[this.index];this._makeQuestion();
    try{W.speechSynthesis?.addEventListener('voiceschanged',()=>this._emit({type:'voices'}));}catch{}
    if(installBridge)this.installBridge();
  }
  getSnapshot(){return{enabled:this.settings.enabled,mode:this.settings.mode,practice:this.settings.practice,settings:{...this.settings},question:this.question,displayEntry:this.displayEntry,total:this.lesson.words.length,index:this.index,basketCount:this.basket.size,stats:{...this.stats},audioStatus:this.audioStatus,notice:this.notice,revision:this.revision,primaryLanguage:this.lesson.primaryLanguage,learningLanguage:this.lesson.learningLanguage,lessonSource:this.lessonSource};}
  subscribe(fn){if(typeof fn!=='function')return()=>{};this.listeners.add(fn);fn(this.getSnapshot(),{type:'initial'});return()=>this.listeners.delete(fn);}
  _emit(event={type:'change'}){this.revision++;const snapshot=this.getSnapshot();for(const fn of this.listeners)try{fn(snapshot,event);}catch(error){try{console.error('GoLingo listener:',error);}catch{}}}
  _applySettings(patch){
    if(!patch||typeof patch!=='object')return;
    for(const key of ['enabled','speech','repeat','showWord','showTranslation','showMarkers','speakTranslation','sentences'])if(typeof patch[key]==='boolean')this.settings[key]=patch[key];
    if(['learn','listen','meaning'].includes(patch.mode))this.settings.mode=patch.mode;
    if(['words','sentences'].includes(patch.practice))this.settings.practice=patch.practice;
    for(const [key,min,max]of [['repeatGap',1.5,30],['rate',.5,1.5]])if(Number.isFinite(Number(patch[key])))this.settings[key]=Math.max(min,Math.min(max,Number(patch[key])));
    if(typeof patch.voiceURI==='string')this.settings.voiceURI=patch.voiceURI;
  }
  setSettings(patch){const previous={...this.settings};this._applySettings(patch);const questionChanged=previous.mode!==this.settings.mode||previous.practice!==this.settings.practice;
    if(questionChanged){this._makeQuestion();this.displayEntry=this.lesson.words[this.index];this._pendingPrompt=null;}
    try{storage()?.setItem(STORE+'.settings',JSON.stringify(this.settings));}catch{}
    this._audioFailed=false;
    if(!this.settings.enabled||!this.settings.speech)this._stopAudio();
    else if(questionChanged||(previous.speech!==this.settings.speech)||(previous.enabled!==this.settings.enabled)){if(this._running)this._playPrompt(false);}
    this._nextRepeat=this._now+this.settings.repeatGap;this._emit({type:'settings'});return this.getSnapshot();
  }
  textFor(entry,translation=false){if(!entry)return'';if(this.settings.practice==='sentences')return translation?(entry.sentenceTranslation||entry.translation||''):(entry.sentence||entry.word||'');return translation?(entry.translation||''):(entry.word||'');}
  _makeQuestion(){
    const entry=this.lesson.words[this.index];const chosen=[entry],seen=new Set([choiceKey(this.textFor(entry))]);
    if(this.settings.mode!=='learn'){
      const n=this.lesson.words.length,start=n>1?Math.floor(Math.random()*n):0;
      for(let step=0;step<n&&chosen.length<3;step++){const e=this.lesson.words[(start+step)%n],key=choiceKey(this.textFor(e));if(!key||seen.has(key))continue;seen.add(key);chosen.push(e);}
      for(let i=chosen.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[chosen[i],chosen[j]]=[chosen[j],chosen[i]];}
    }
    const id=++this.questionSequence;const choices=chosen.map((e,i)=>Object.freeze({token:`q${id}:${i}`,entry:e}));this._correctToken=choices.find(c=>c.entry===entry).token;
    this.question=Object.freeze({id,entry,choices:Object.freeze(choices)});
  }
  getChoices(){return this.settings.enabled?this.question.choices.slice():[];}
  isCorrect(token){return !!this.settings.enabled&&String(token)===this._correctToken;}
  importWords(payload,options={}){
    try{
      let incoming=normalizeLesson(payload,{primaryLanguage:this.lesson.primaryLanguage,learningLanguage:this.lesson.learningLanguage});
      const append=options?.append===true;
      if(append&&(incoming.primaryLanguage!==this.lesson.primaryLanguage||incoming.learningLanguage!==this.lesson.learningLanguage))throw new Error('Append requires the same primary and learning languages. Replace the lesson to change language pair.');
      if(append)incoming=normalizeLesson({...incoming,words:[...this.lesson.words,...incoming.words]});
      this._stopAudio();this._pendingPrompt=null;this._audioFailed=false;this.lesson=incoming;this.lessonFingerprint=fingerprint(incoming);this.index=0;this.lessonSource=options?.source||'imported';this.settings.enabled=true;
      if(!append){this.basket.clear();this.stats={correct:0,attempts:0,streak:0,studied:0};}
      this.displayEntry=this.lesson.words[0];this._makeQuestion();this.notice=`Loaded ${incoming.words.length.toLocaleString()} ${incoming.words.length===1?'entry':'entries'}.`+(incoming.invalidEntries?` ${incoming.invalidEntries} empty or invalid entries were skipped.`:'');
      try{storage()?.setItem(STORE+'.lesson',JSON.stringify({...this.getLesson(),source:this.lessonSource}));}catch{this.notice+=' Browser storage is full or blocked; this lesson is available while the tab stays open.';}
      this._saveProgress();this._emit({type:'import',count:incoming.words.length});
      const result={ok:true,count:incoming.words.length,primaryLanguage:incoming.primaryLanguage,learningLanguage:incoming.learningLanguage};this._publishImportResult(result);
      if(this._running)this._playPrompt(false);return result;
    }catch(error){const message=error?.message||'Could not load this lesson.';this.notice=message;this._emit({type:'error',message});this._publishImportResult({ok:false,error:message});throw error;}
  }
  selectDemo(code){return this.importWords(demoLesson(code),{source:'demo'});}
  getLesson(){return{primaryLanguage:this.lesson.primaryLanguage,learningLanguage:this.lesson.learningLanguage,...(this.lesson.title?{title:this.lesson.title}:{}),words:this.lesson.words.map(cloneEntry)};}
  getBasket(){return{primaryLanguage:this.lesson.primaryLanguage,learningLanguage:this.lesson.learningLanguage,words:[...this.basket.values()].map(cloneEntry)};}
  clearBasket(){this.basket.clear();this._saveProgress();this._emit({type:'basket-cleared'});return this.getBasket();}
  _saveProgress(){try{storage()?.setItem(STORE+'.progress',JSON.stringify({lessonFingerprint:this.lessonFingerprint,index:this.index,stats:this.stats,words:[...this.basket.values()]}));}catch{}}
  answer(token,{source='signal'}={}){
    if(!this.settings.enabled)return{correct:false,entry:null,reason:'disabled'};
    const selected=this.question.choices.find(c=>c.token===String(token));if(!selected)return{correct:false,entry:null,reason:'stale'};
    if(selected.token!==this._correctToken){
      if(this._now<this._wrongUntil)return{correct:false,entry:selected.entry,reason:'cooldown'};
      this._wrongUntil=this._now+.65;this.stats.attempts++;this.stats.streak=0;this.notice=this.settings.mode==='meaning'?'Try another word for that meaning.':'Listen again, then choose another word.';this._saveProgress();this._emit({type:'answer',correct:false,entry:selected.entry,source});this._playPrompt(false);return{correct:false,entry:selected.entry,reason:'incorrect'};
    }
    const entry=selected.entry;this.stats.attempts++;this.stats.correct++;this.stats.streak++;this.stats.studied++;this.basket.set(keyFor(entry),entry);this.displayEntry=entry;
    this.index=(this.index+1)%this.lesson.words.length;this._makeQuestion();this._saveProgress();this.notice='';this._emit({type:'answer',correct:true,entry,source});
    if(this.settings.mode==='learn')this._startSequence(this._entryTasks(entry,true),{manual:false});
    else{this._pendingPrompt=null;this._startSequence(this._entryTasks(entry,false),{manual:false,onDone:()=>{this._pendingPrompt=this._now+.9;}});if(!this._canSpeak(false))this._pendingPrompt=this._now+.9;}
    return{correct:true,entry};
  }
  next(){this.index=(this.index+1)%this.lesson.words.length;this._makeQuestion();this.displayEntry=this.question.entry;this._pendingPrompt=null;this._saveProgress();this._emit({type:'skip'});this._playPrompt(false);return this.getSnapshot();}
  unlock(){this._unlocked=true;this._audioFailed=false;try{W.speechSynthesis?.resume();}catch{}if(this._running&&!this._audioBusy&&this.settings.enabled&&this.settings.speech)this._playPrompt(false);return{ok:true};}
  setRunning(value){const next=!!value;if(next===this._running)return;this._running=next;if(!next){this._stopAudio();this._pendingPrompt=null;this.audioStatus='Pronunciation paused.';this._emit({type:'audio'});}else{this._audioFailed=false;this._nextRepeat=this._now;this._playPrompt(false);}}
  tick(dt){this._now+=Math.max(0,Math.min(.25,Number(dt)||0));if(!this._running||!this.settings.enabled||!this.settings.speech||!this._unlocked||this._audioBusy||this._audioFailed)return;
    if(this._pendingPrompt!==null){if(this._now>=this._pendingPrompt){this._pendingPrompt=null;this._playPrompt(false);}return;}
    if(this.settings.repeat&&this._now>=this._nextRepeat)this._playPrompt(false);
  }
  getVoices(){try{return(W.speechSynthesis?.getVoices()||[]).map(v=>({name:v.name,lang:v.lang,voiceURI:v.voiceURI}));}catch{return[];}}
  _entryLanguage(entry,translation=false){return translation?(entry.primaryLanguage||entry.translationLanguage||this.lesson.primaryLanguage):(entry.learningLanguage||entry.language||this.lesson.learningLanguage);}
  _entryTasks(entry,includeSentence=true){
    if(!entry)return[];const sentenceMode=this.settings.practice==='sentences';
    const tasks=[{text:this.textFor(entry),lang:this._entryLanguage(entry),url:sentenceMode?(entry.sentenceAudioUrl||(!entry.sentence?entry.audioUrl:'')):entry.audioUrl}];
    if(this.settings.speakTranslation&&this.textFor(entry,true))tasks.push({text:this.textFor(entry,true),lang:this._entryLanguage(entry,true),url:sentenceMode?entry.sentenceTranslationAudioUrl:entry.translationAudioUrl});
    if(includeSentence&&this.settings.sentences&&!sentenceMode&&entry.sentence&&entry.sentence!==entry.word)tasks.push({text:entry.sentence,lang:this._entryLanguage(entry),url:entry.sentenceAudioUrl});
    return tasks.filter(t=>t.text);
  }
  _promptTasks(){const entry=this.settings.mode==='learn'?this.displayEntry:this.question.entry;if(this.settings.mode==='meaning'){const translation=this.textFor(entry,true);if(!translation)return[];return[{text:translation,lang:this._entryLanguage(entry,true),url:this.settings.practice==='sentences'?entry.sentenceTranslationAudioUrl:entry.translationAudioUrl}];}if(this.settings.mode==='listen')return this._entryTasks(entry,false).slice(0,1);return this._entryTasks(entry,true);}
  _playPrompt(manual){const tasks=this._promptTasks();if(!tasks.length){this.audioStatus=this.settings.mode==='meaning'?'This entry has no translation. Add a meaning or use Learn / Listen.':'No pronunciation text is available.';this._audioFailed=true;this._emit({type:'audio'});return;}this._startSequence(tasks,{manual});}
  speakPrompt(){this._unlocked=true;this._audioFailed=false;this._pendingPrompt=null;this._playPrompt(true);}
  speakEntry(entry,{sentence=false}={}){this._unlocked=true;this._audioFailed=false;const tasks=sentence?[{text:entry?.sentence||entry?.word||'',lang:this._entryLanguage(entry||{}),url:entry?.sentenceAudioUrl}]:[{text:entry?.word||'',lang:this._entryLanguage(entry||{}),url:entry?.audioUrl}];this._startSequence(tasks,{manual:true});}
  speakSentence(){this.speakEntry(this.settings.mode==='learn'?this.displayEntry:this.question.entry,{sentence:true});}
  _canSpeak(manual){return this._unlocked&&(manual||(this._running&&this.settings.enabled&&this.settings.speech));}
  _stopAudio(){this._audioRun++;this._audioBusy=false;if(this._watchdog!==null){clearTimeout(this._watchdog);this._watchdog=null;}if(this._audio){this._audio.onended=this._audio.onerror=null;try{this._audio.pause();}catch{}this._audio=null;}if(this._utterance){this._utterance.onend=this._utterance.onerror=null;this._utterance=null;}try{W.speechSynthesis?.cancel();}catch{}}
  _startSequence(tasks,{manual=false,onDone=null}={}){
    this._stopAudio();this._nextRepeat=this._now+this.settings.repeatGap;
    if(!this._canSpeak(manual)){this.audioStatus=!this._unlocked?'Tap Launch or Listen to enable pronunciation.':!this.settings.speech?'Automatic speech is off.':'Pronunciation paused.';this._emit({type:'audio'});return;}
    tasks=tasks.filter(t=>t&&t.text);if(!tasks.length){onDone?.();return;}
    const run=this._audioRun;this._audioFailed=false;this._audioBusy=true;this.audioStatus='Playing pronunciation…';this._emit({type:'audio'});let index=0;
    const next=success=>{if(run!==this._audioRun)return;if(success===false){this._audioBusy=false;this._audioFailed=true;this._emit({type:'audio'});return;}
      if(index>=tasks.length){this._audioBusy=false;this._nextRepeat=this._now+this.settings.repeatGap;this.audioStatus=this._running&&this.settings.repeat&&this.settings.speech?'Repeat until the next word.':'Ready to replay.';this._emit({type:'audio'});onDone?.();return;}
      this._playTask(tasks[index++],run,next);
    };next(true);
  }
  _playTask(task,run,done){
    let complete=false,fallbackUsed=false;const deadline=Math.min(120000,Math.max(18000,task.text.length*125+7000));
    const valid=()=>run===this._audioRun&&!complete;
    const clear=()=>{if(this._watchdog!==null){clearTimeout(this._watchdog);this._watchdog=null;}if(this._audio){this._audio.onended=this._audio.onerror=null;try{this._audio.pause();}catch{}this._audio=null;}if(this._utterance){this._utterance.onend=this._utterance.onerror=null;this._utterance=null;}};
    const finish=(success,message='')=>{if(!valid())return;complete=true;clear();if(message)this.audioStatus=message;done(success);};
    const speakText=()=>{
      if(!valid()||fallbackUsed)return;fallbackUsed=true;clear();
      if(!W.speechSynthesis||typeof W.SpeechSynthesisUtterance!=='function'){finish(false,'Speech is unavailable in this browser. Your words remain available to read.');return;}
      try{
        const u=new W.SpeechSynthesisUtterance(task.text);this._utterance=u;u.lang=task.lang;u.rate=this.settings.rate;u.volume=1;
        const voices=W.speechSynthesis.getVoices()||[],wanted=String(task.lang).toLowerCase();
        const sameLang=v=>String(v.lang).toLowerCase().split('-')[0]===wanted.split('-')[0];
        const voice=voices.find(v=>v.voiceURI===this.settings.voiceURI&&sameLang(v))||voices.find(v=>String(v.lang).toLowerCase()===wanted)||voices.find(sameLang);if(voice)u.voice=voice;
        u.onend=()=>finish(true);u.onerror=e=>finish(false,['canceled','interrupted'].includes(e.error)?'Tap Listen to replay.':'Pronunciation could not play. Tap Listen to try again.');
        this._watchdog=setTimeout(()=>{if(!valid())return;try{W.speechSynthesis.cancel();}catch{}finish(false,'Pronunciation stopped. Tap Listen to replay.');},deadline);
        W.speechSynthesis.resume();W.speechSynthesis.speak(u);
      }catch{finish(false,'Pronunciation could not play. Tap Listen to try again.');}
    };
    if(task.url&&!this._failedAudioUrls.has(task.url)&&typeof W.Audio==='function'){
      try{const player=new W.Audio(task.url);this._audio=player;player.preload='auto';player.onended=()=>finish(true);const fallback=()=>{if(!valid())return;this._failedAudioUrls.add(task.url);speakText();};player.onerror=fallback;this._watchdog=setTimeout(fallback,deadline);const promise=player.play();promise?.catch?.(fallback);}catch{this._failedAudioUrls.add(task.url);speakText();}
    }else speakText();
  }
  exportBasket(){
    const payload=this.getBasket();if(!payload.words.length)throw new Error('Collect a word before exporting your review basket.');
    const native=W.webkit?.messageHandlers?.golingoExport;
    if(native&&typeof native.postMessage==='function'){native.postMessage(payload);return{ok:true,method:'native',count:payload.words.length};}
    if(typeof document==='undefined'||typeof Blob!=='function'||typeof URL.createObjectURL!=='function')throw new Error('Downloads are unavailable here. Use Copy JSON instead.');
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='sky-reach-golingo-words.json';a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return{ok:true,method:'download',count:payload.words.length};
  }
  _dispatch(name,detail){try{if(typeof W.CustomEvent==='function')W.dispatchEvent(new W.CustomEvent(name,{detail}));}catch{}}
  _native(type,data={}){try{W.webkit?.messageHandlers?.golingo?.postMessage({type,game:'sky-reach',...data});}catch{}}
  _publishImportResult(result){if(!this._bridgeInstalled)return;this._native(result.ok?'wordsImported':'error',result);this._dispatch('golingo:importResult',result);}
  _reply(target,origin,result){try{target?.postMessage?.({type:result.ok?'GOLINGO_WORDS_LOADED':'GOLINGO_IMPORT_ERROR',game:'sky-reach',...result},origin&&origin!=='null'?origin:'*');}catch{}}
  installBridge(){
    if(this._bridgeInstalled||!W.addEventListener)return;this._bridgeInstalled=true;W.__skyReachLearningController=this;
    const api=W.GoLingoGame=W.GoLingoGame||{};Object.assign(api,{ready:true,importWords:(payload,options)=>this.importWords(payload,options),getLesson:()=>this.getLesson(),getBasket:()=>this.getBasket(),getState:()=>this.getSnapshot(),setMode:mode=>this.setSettings({mode}),exportBasket:()=>this.exportBasket()});
    const bridge=W.GoLingoBridge=W.GoLingoBridge||{};Object.assign(bridge,{load:api.importWords,importWords:api.importWords,getLesson:api.getLesson,getBasket:api.getBasket});W.setGoLingoData=api.importWords;W.receiveGoLingoData=api.importWords;
    const custom=event=>{try{this.importWords(event.detail,{source:'event'});}catch{}};W.addEventListener('golingo:lesson',custom);W.addEventListener('golingo:importWords',custom);
    W.addEventListener('message',event=>{
      if(event.source&&event.source!==W&&event.source!==W.parent&&event.source!==W.opener)return;
      let payload=event.data;if(typeof payload==='string')try{payload=JSON.parse(payload);}catch{return;}
      if(!payload||typeof payload!=='object')return;
      const recognized=MESSAGE_TYPES.has(String(payload.type||'').toLowerCase()),rawLesson=!payload.type&&LIST_KEYS.some(k=>Array.isArray(payload[k]));
      if(!recognized&&!(event.source&&rawLesson))return;
      let result;try{result=this.importWords(payload,{source:'message'});}catch(error){result={ok:false,error:error.message};}this._reply(event.source,event.origin,result);
    });
    // Explicit URL payloads outrank the same-tab gallery handoff, which outranks saved defaults.
    let incoming=null,incomingSource='';
    try{
      const location=W.location||{};const query=new URLSearchParams(location.search||''),hash=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
      for(const params of [hash,query]){for(const key of ['golingoLesson','lesson','data','payload','golingo','golingoData','words','sentences']){if(params.has(key)){const value=params.get(key);incoming=['words','sentences'].includes(key)?{[key]:parseLessonText(value),primaryLanguage:params.get('primaryLanguage')||params.get('translationLanguage')||this.lesson.primaryLanguage,learningLanguage:params.get('learningLanguage')||this.lesson.learningLanguage}:value;if(incoming&&['words','sentences'].includes(key)&&!Array.isArray(incoming[key]))incoming[key]=incoming[key]?.words||incoming[key]?.sentences||[];incomingSource='link';break;}}if(incoming!==null)break;}
      if(incoming===null)for(const key of ['golingoLesson','golingo:active-lesson:v1']){const saved=storage('sessionStorage')?.getItem(key);if(saved){incoming=saved;incomingSource='GoLingo';break;}}
      if(incoming!==null)this.importWords(incoming,{source:incomingSource});
    }catch(error){this.notice=error.message;this._emit({type:'error',message:error.message});}
    const queue=Array.isArray(W.__skyReachLessonQueue)?W.__skyReachLessonQueue.splice(0):[];
    for(const queued of queue){let result;try{result=this.importWords(queued.payload,queued.options);}catch(error){result={ok:false,error:error.message};}if(queued.replyTo)this._reply(queued.replyTo,queued.origin,result);}
    const ready={game:'sky-reach',count:this.lesson.words.length,supportsPostMessage:true,supportsImportWords:true};this._native('ready',ready);this._dispatch('golingo:ready',ready);
    for(const target of [W.parent,W.opener])if(target&&target!==W)try{target.postMessage({type:'GOLINGO_GAME_READY',...ready},'*');target.postMessage({type:'GAME_READY',...ready},'*');}catch{}
    this._emit({type:'ready'});
  }
}

export const learning = new LearningController({installBridge:true});
