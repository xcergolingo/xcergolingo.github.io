import { LessonAudio, safeAudioUrl } from './lesson-audio.js';
export { safeAudioUrl } from './lesson-audio.js';

export const LANGUAGES = Object.freeze([
  {code:'en',name:'English'},{code:'es',name:'Spanish'},{code:'ja',name:'Japanese'},
  {code:'zh',name:'Chinese'},{code:'fr',name:'French'},{code:'de',name:'German'},
  {code:'ko',name:'Korean'},{code:'vi',name:'Vietnamese'},{code:'pt',name:'Portuguese'},
  {code:'it',name:'Italian'},{code:'ru',name:'Russian'},{code:'ar',name:'Arabic'},
  {code:'hi',name:'Hindi'},{code:'th',name:'Thai'},{code:'uk',name:'Ukrainian'}
]);
export const DEFAULT_LANGUAGES_CODES = Object.freeze({learningLanguage:'es',primaryLanguage:'en'});
const DEFAULT_PREFERENCES = Object.freeze({showCard:true,showTranslation:true,showLabels:true,repeat:true});
const STORAGE = {lesson:'pinefall.learning.lesson.v1',preferences:'pinefall.learning.preferences.v1',basket:'pinefall.learning.basket.v1'};
const MAX_ENTRIES = 500, MAX_INPUT = 100000;
const NATURE = {
  en:['deer','forest','tree','water','mountain','river','sky','leaf'],
  es:['ciervo','bosque','árbol','agua','montaña','río','cielo','hoja'],
  ja:['鹿','森','木','水','山','川','空','葉'],
  zh:['鹿','森林','树','水','山','河流','天空','叶子'],
  fr:['cerf','forêt','arbre','eau','montagne','rivière','ciel','feuille'],
  de:['Hirsch','Wald','Baum','Wasser','Berg','Fluss','Himmel','Blatt'],
  ko:['사슴','숲','나무','물','산','강','하늘','잎'],
  vi:['hươu','rừng','cây','nước','núi','sông','bầu trời','lá'],
  pt:['cervo','floresta','árvore','água','montanha','rio','céu','folha'],
  it:['cervo','foresta','albero','acqua','montagna','fiume','cielo','foglia'],
  ru:['олень','лес','дерево','вода','гора','река','небо','лист'],
  ar:['أيل','غابة','شجرة','ماء','جبل','نهر','سماء','ورقة شجر'],
  hi:['हिरण','जंगल','पेड़','पानी','पहाड़','नदी','आकाश','पत्ता'],
  th:['กวาง','ป่า','ต้นไม้','น้ำ','ภูเขา','แม่น้ำ','ท้องฟ้า','ใบไม้'],
  uk:['олень','ліс','дерево','вода','гора','річка','небо','листок']
};
let keySequence = 0;
function text(value, max = 1000) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0,max) : ''; }
function language(value, fallback) {
  if (value && typeof value === 'object') value = value.code || value.language || value.lang;
  const name = text(value, 60);
  const named = LANGUAGES.find(item => item.name.toLowerCase() === name.toLowerCase());
  if (named) return named.code;
  const normalized = name.replace(/_/g,'-');
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(normalized) ? normalized : fallback;
}
function readStore(name, session = false) { try { const value = (session ? globalThis.sessionStorage : globalThis.localStorage)?.getItem(name); return value ? JSON.parse(value) : null; } catch { return null; } }
function saveStore(name, value) { try { globalThis.localStorage?.setItem(name,JSON.stringify(value)); } catch { /* Storage may be restricted in a web view. */ } }
function shuffle(items) { const result=items.slice(); for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];} return result; }
function audioValue(value) { return safeAudioUrl(typeof value === 'object' && value ? value.url || value.src : value); }
function base(code) { return String(code).toLowerCase().split('-')[0]; }
function parseInput(payload) {
  if (typeof payload === 'string') {
    if (payload.length > MAX_INPUT) throw new Error('Lesson is too large. Use at most 100,000 characters.');
    let source = payload.trim();
    if (!source) throw new Error('This lesson is empty. Add a word or sentence first.');
    if (/^[\[{]/.test(source)) {
      try { return JSON.parse(source); } catch { throw new Error('That JSON could not be read. Check the commas and quotation marks.'); }
    }
    return {words:source.split(/\r?\n/).filter(line=>line.trim()).map(line=> {
      const divider = line.indexOf('=');
      return divider >= 0 ? {word:line.slice(0,divider).trim(),translation:line.slice(divider+1).trim()} : {word:line.trim()};
    })};
  }
  if (payload === null || typeof payload !== 'object') throw new Error('Provide a JSON lesson, a word list, or lines of word = translation.');
  let serialized;
  try { serialized = JSON.stringify(payload); } catch { throw new Error('Lesson data must be valid JSON.'); }
  if (!serialized || serialized.length > MAX_INPUT) throw new Error('Lesson is too large. Use at most 100,000 characters.');
  return payload;
}

/** A deliberately small schema accepts established GoLingo word/phrase formats. */
export function normalizeLesson(payload, defaults = DEFAULT_LANGUAGES_CODES) {
  let input = parseInput(payload);
  let inheritedMetadata = {};
  for (let i=0; i<4 && input && !Array.isArray(input) && typeof input === 'object'; i++) {
    if (['words','sentences','phrases','items','entries'].some(key=>Array.isArray(input[key]))) break;
    const nested = input.lesson ?? input.payload ?? input.data;
    if (nested === undefined) break;
    inheritedMetadata = {...inheritedMetadata, ...input};
    input = parseInput(nested);
  }
  if (!input || typeof input !== 'object') throw new Error('The lesson must contain a list of words or sentences.');
  const metadata = {...inheritedMetadata, ...(Array.isArray(input) ? {} : input)};
  const learningLanguage = language(metadata.learningLanguage || metadata.targetLanguage || metadata.language || metadata.lang,defaults.learningLanguage || 'es');
  const primaryLanguage = language(metadata.primaryLanguage || metadata.nativeLanguage || metadata.sourceLanguage || metadata.translationLanguage,defaults.primaryLanguage || 'en');
  const rows = [];
  if (Array.isArray(input)) input.forEach(row=>rows.push({row,kind:'word'}));
  else {
    for (const field of ['words','sentences','phrases','items','entries']) {
      if (Array.isArray(input[field])) input[field].forEach(row=>rows.push({row,kind:field==='sentences'||field==='phrases'?'sentence':'word'}));
    }
  }
  if (rows.length > MAX_ENTRIES) throw new Error('Use at most 500 words and sentences in one lesson.');
  if (!rows.length) throw new Error('No entries found. Include a words, sentences, phrases, items, or entries array.');
  const serial = ++keySequence;
  const entries = [];
  let skipped = 0;
  for (const {row,kind:rowKind} of rows) {
    if (!(typeof row === 'string' || row && typeof row === 'object' && !Array.isArray(row))) { skipped++; continue; }
    let value = typeof row === 'string' ? {word:row} : row;
    const kind = value.kind === 'sentence' || value.type === 'sentence' || rowKind === 'sentence' ? 'sentence' : 'word';
    const phrase = typeof value.sentence === 'object' ? value.sentence.text || value.sentence.sentence : value.sentence;
    const word = text(value.word ?? value.term ?? value.text ?? value.target ?? value.front ?? (kind==='sentence'?phrase:undefined));
    if (!word) { skipped++; continue; }
    let rawID = value.id ?? value.wordId ?? value.wordID ?? value.uuid;
    if (rawID === undefined || rawID === null) rawID = `pinefall-${serial}-${entries.length+1}`;
    if (typeof rawID !== 'string' && typeof rawID !== 'number') throw new Error('Entry IDs must be text or numbers.');
    if (typeof rawID === 'string' && rawID.length > 500) throw new Error('An entry ID is too long.');
    const sentence = kind === 'sentence' ? '' : text(phrase ?? value.exampleSentence ?? value.example,2000);
    const nestedSentence = value.sentence && typeof value.sentence==='object' ? value.sentence : {};
    const entry = Object.freeze({
      id:rawID, key:`pinefall-entry-${serial}-${entries.length+1}`,
      word, translation:text(value.translation ?? value.meaning ?? value.native ?? value.back ?? value.translationText ?? (kind==='sentence'?value.sentenceTranslation ?? nestedSentence.translation:undefined)),
      sentence,
      sentenceTranslation:text(value.sentenceTranslation ?? value.exampleTranslation ?? nestedSentence.translation,2000),
      audioUrl:audioValue(value.audioUrl ?? value.audioURL ?? value.audio ?? value.pronunciationAudio ?? (kind==='sentence'?value.sentenceAudioUrl ?? value.sentenceAudioURL:undefined)),
      sentenceAudioUrl:kind==='sentence'?'':audioValue(value.sentenceAudioUrl ?? value.sentenceAudioURL ?? value.exampleAudioUrl ?? nestedSentence.audioUrl),
      kind
    });
    entries.push(entry);
  }
  if (!entries.length) throw new Error('This lesson has no readable words or sentences. Empty entries were skipped.');
  return { version:1,title:text(metadata.title || metadata.name,160) || 'My forest lesson',learningLanguage,primaryLanguage,words:entries,skipped };
}
function defaultLesson(learningLanguage='es',primaryLanguage='en') {
  const learning = language(learningLanguage,'es'), primary = language(primaryLanguage,'en');
  const target = NATURE[base(learning)], translations = NATURE[base(primary)];
  if (!target || !translations) throw new Error('Choose one of the available languages for the forest starter lesson.');
  return normalizeLesson({title:'Forest essentials',learningLanguage:learning,primaryLanguage:primary,words:target.map((word,index)=>({id:`nature-${NATURE.en[index]}`,word,translation:translations[index]}))});
}
function explicitUrlLesson() {
  if (!globalThis.location) return null;
  try {
    const url = new URL(globalThis.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#\??/,''));
    const keys = ['golingoLesson','lesson','payload','data','words','sentences'];
    // Query intent takes precedence over an older hash, matching the hub launch contract.
    for (const params of [url.searchParams,hash]) {
      for (const key of keys) {
        if (!params.has(key)) continue;
        let payload = params.get(key);
        if (!payload) throw new Error('The lesson link is empty.');
        // URLSearchParams has already decoded percent escapes exactly once.
        if (key==='words'||key==='sentences') {
          try { const parsed=JSON.parse(payload); payload=Array.isArray(parsed)?{[key]:parsed}:parsed; }
          catch { payload = {[key]:payload.split(/\r?\n/).filter(Boolean)}; }
        }
        const languageValue = (...names) => {
          for (const name of names) {
            const value = params.get(name) || url.searchParams.get(name) || hash.get(name);
            if (value) return value;
          }
          return undefined;
        };
        const urlMetadata = {
          learningLanguage:languageValue('learningLanguage','targetLanguage','language','lang'),
          primaryLanguage:languageValue('primaryLanguage','nativeLanguage','sourceLanguage','translationLanguage')
        };
        const decoded = parseInput(payload);
        // The lesson's own metadata wins; query/hash language fields fill missing metadata.
        return {payload:{...urlMetadata,...(Array.isArray(decoded)?{words:decoded}:decoded)},source:'url'};
      }
    }
  } catch (error) { return {error}; }
  return null;
}

export class PinefallLearning {
  constructor({onChange=()=>{},onMessage=()=>{}}={}) {
    this.onChange=onChange;this.onMessage=onMessage;this.disposed=false;this.active=false;
    this._preferences={...DEFAULT_PREFERENCES};
    const storedPreferences=readStore(STORAGE.preferences);
    for(const key of Object.keys(DEFAULT_PREFERENCES)) if(typeof storedPreferences?.[key]==='boolean')this._preferences[key]=storedPreferences[key];
    this._lesson=defaultLesson();this._isDefault=true;this._basket=[];this._order=[];this._cursor=0;this._learnedCount=0;
    this.audio=new LessonAudio({onMessage:message=>this.onMessage(message)});
    this.bridge=globalThis.window?.PinefallBridge;
    const initialErrors=[];
    const applyInitial=(payload,append=false,source='saved')=>{
      try { this._replace(payload,append);this._isDefault=false;this._source=source;return true; }
      catch(error){initialErrors.push(error.message);return false;}
    };
    const saved=readStore(STORAGE.lesson);
    if(saved?.lesson) { if(applyInitial(saved.lesson,false,'saved')) this._isDefault=saved.isDefault===true; }
    const hub=readStore('golingo:active-lesson:v1',true);
    if(hub)applyInitial(hub,false,'hub');
    const queued=this.bridge?.takePending?.()||[];
    for(const item of queued)applyInitial(item.payload,item.options?.append===true,item.source||'native');
    const linked=explicitUrlLesson();
    if(linked?.error)initialErrors.push(linked.error.message);
    else if(linked)applyInitial(linked.payload,false,'url');
    const savedBasket=readStore(STORAGE.basket);
    if(Array.isArray(savedBasket)) {
      // Treat persisted data with the same care as imported data. A damaged basket cannot block play.
      for(const item of savedBasket.slice(-MAX_ENTRIES)) {
        try { const entry=normalizeLesson({words:[item]},this._lesson).words[0]; this._basket.push(Object.freeze({...entry,learningLanguage:language(item.learningLanguage,this._lesson.learningLanguage),primaryLanguage:language(item.primaryLanguage,this._lesson.primaryLanguage),collectedAt:text(item.collectedAt,40)})); } catch {}
      }
    }
    this._order=this._lesson.words.slice();this._persist();
    this.bridge?.connect?.({
      importLesson:(payload,options)=>this.importLesson(payload,options),
      exportLesson:options=>this.exportLesson(options),getState:()=>this.getState()
    });
    const later=globalThis.queueMicrotask || (fn=>Promise.resolve().then(fn));
    later(()=>{
      if(this.disposed)return;
      this._notify('ready');
      this.bridge?.report?.({count:this.total,lastSource:this._source||'default',lastError:initialErrors.at(-1)||null});
      this._emit('ready',{total:this.total,learningLanguage:this._lesson.learningLanguage,primaryLanguage:this._lesson.primaryLanguage,source:this._source||'default'});
      if(queued.length||linked&&!linked.error||hub)this._emit('wordsImported',{count:this.total,total:this.total,source:this._source||'default',append:false,ids:this.entries.map(e=>e.id)});
      if(initialErrors.length){this.onMessage(initialErrors.at(-1));this._emit('error',{message:initialErrors.at(-1),source:'lesson-import'});}
    });
  }
  get lesson(){return this._lesson;}
  get entries(){return this._lesson.words;}
  get current(){return this._order[this._cursor]||null;}
  get preferences(){return this._preferences;}
  get basket(){return this._basket;}
  get learnedCount(){return this._learnedCount;}
  get total(){return this._order.length;}
  get complete(){return this.total>0&&this._cursor>=this.total;}
  get isDefault(){return this._isDefault;}
  get isSpeaking(){return !!this.audio.busy;}
  get exportableBasketCount(){return this._currentPairBasket().length;}
  _currentPairBasket(){
    const normalize=code=>String(code).replace(/_/g,'-').toLowerCase();
    return this._basket.filter(entry=>normalize(entry.learningLanguage||this.lesson.learningLanguage)===normalize(this.lesson.learningLanguage)&&normalize(entry.primaryLanguage||this.lesson.primaryLanguage)===normalize(this.lesson.primaryLanguage));
  }
  _emit(type,detail){this.bridge?.emit?.(type,detail);}
  _notify(reason){if(!this.disposed)this.onChange({...this.getState(),reason});}
  _persist(){saveStore(STORAGE.lesson,{lesson:this.exportLesson(),isDefault:this._isDefault});saveStore(STORAGE.preferences,this._preferences);saveStore(STORAGE.basket,this._basket.slice(-MAX_ENTRIES));}
  _replace(payload,append=false){
    const normalized=normalizeLesson(payload,this._lesson||DEFAULT_LANGUAGES_CODES);
    const words=append?[...this._lesson.words,...normalized.words]:normalized.words;
    if(words.length>MAX_ENTRIES)throw new Error('The combined lesson would exceed 500 entries. Replace the lesson or import fewer entries.');
    // Appending must not silently change the language of existing words.
    if(append&&this._lesson.words.length&&(base(normalized.learningLanguage)!==base(this._lesson.learningLanguage)||base(normalized.primaryLanguage)!==base(this._lesson.primaryLanguage)))throw new Error('Use the same language pair when appending, or replace the lesson.');
    this._lesson=Object.freeze({...normalized,words:Object.freeze(words),...(append?{learningLanguage:this._lesson.learningLanguage,primaryLanguage:this._lesson.primaryLanguage}:{} )});
  }
  begin(){
    const carrySentence=this.complete&&this._finalSequence&&this.active;
    if(!carrySentence)this.audio.cancel();
    this._order=shuffle(this.entries);this._cursor=0;this._learnedCount=0;
    const carried=carrySentence&&this.audio.appendToSequence([this._wordAudio(this.current)],{repeatLast:this._preferences.repeat});
    this._finalSequence=false;
    this._notify('begin');this._emit('progressChanged',this._progress());
    if(this.active&&!carried)this._speakCurrent();return this.current;
  }
  _progress(){return {learnedCount:this.learnedCount,total:this.total,complete:this.complete,currentId:this.current?.id??null};}
  _speakCurrent(){if(this.active&&this.current)this.audio.playSequence([this._wordAudio(this.current)],{repeatLast:this._preferences.repeat});}
  _wordAudio(entry){return {text:entry.word,audioUrl:entry.audioUrl,language:entry.learningLanguage||this.lesson.learningLanguage};}
  _basketIdentity(entry){return JSON.stringify([entry.learningLanguage||this.lesson.learningLanguage,entry.primaryLanguage||this.lesson.primaryLanguage,entry.id,entry.word,entry.translation]);}
  collect(){
    const entry=this.current;
    if(!entry)return {entry:null,next:null,complete:this.complete,learnedCount:this.learnedCount,total:this.total};
    this.audio.cancel();
    const collected=Object.freeze({...entry,learningLanguage:this.lesson.learningLanguage,primaryLanguage:this.lesson.primaryLanguage,collectedAt:new Date().toISOString()});
    const identity=this._basketIdentity(collected);
    const alreadyCollected=this._basket.some(item=>this._basketIdentity(item)===identity);
    if(!alreadyCollected){this._basket.push(collected);if(this._basket.length>MAX_ENTRIES)this._basket.shift();}
    this._cursor++;this._learnedCount++;
    this._persist();this._notify('collect');
    if(!alreadyCollected)this._emit('wordAddedToBasket',{id:entry.id,wordId:entry.id,word:entry.word,translation:entry.translation,entry:collected,basketCount:this._basket.length});
    this._emit('progressChanged',this._progress());
    const items=[this._wordAudio(entry)];
    if(entry.sentence&&entry.sentence.trim()!==entry.word.trim())items.push({text:entry.sentence,audioUrl:entry.sentenceAudioUrl,language:this.lesson.learningLanguage});
    if(this.current)items.push(this._wordAudio(this.current));
    this._finalSequence=!this.current&&this.active;
    if(this.active&&items.length)this.audio.playSequence(items,{repeatLast:!!this.current&&this._preferences.repeat});
    return {entry,next:this.current,complete:this.complete,learnedCount:this.learnedCount,total:this.total};
  }
  candidates(count=4){
    if(!this.current)return [];
    const wanted=Math.max(1,Math.min(MAX_ENTRIES,Math.floor(Number(count)||1)));
    const seen=new Set([this.current.word.normalize('NFC').toLocaleLowerCase()]);
    const distractors=[];
    for(const entry of shuffle(this.entries)) {const token=entry.word.normalize('NFC').toLocaleLowerCase();if(!seen.has(token)){seen.add(token);distractors.push(entry);if(distractors.length>=wanted-1)break;}}
    return shuffle([this.current,...(wanted===1?[]:distractors)]);
  }
  importLesson(payload,{append=false}={}){
    // Validation completes before changing or cancelling the current session.
    this._replace(payload,append);this._isDefault=false;this._source='import';this._finalSequence=false;this.begin();this._persist();this._notify('import');
    const result={ok:true,count:this.total,total:this.total,append:!!append,skipped:this.lesson.skipped||0};
    this.bridge?.report?.({lastError:null,count:this.total,lastSource:'import'});
    this._emit('wordsImported',{...result,ids:this.entries.map(entry=>entry.id),learningLanguage:this.lesson.learningLanguage,primaryLanguage:this.lesson.primaryLanguage});
    return result;
  }
  useDefault(learningLanguage=this.lesson.learningLanguage,primaryLanguage=this.lesson.primaryLanguage){
    const lesson=defaultLesson(learningLanguage,primaryLanguage);this._lesson=Object.freeze({...lesson,words:Object.freeze(lesson.words)});this._isDefault=true;this._source='default';this._finalSequence=false;this.begin();this._persist();this._notify('languages');
    this._emit('wordsImported',{count:this.total,total:this.total,append:false,source:'default',ids:this.entries.map(entry=>entry.id)});return this.lesson;
  }
  setLanguages(learningLanguage,primaryLanguage){
    const target=language(learningLanguage,this.lesson.learningLanguage),native=language(primaryLanguage,this.lesson.primaryLanguage);
    if(this._isDefault)return this.useDefault(target,native);
    this._lesson=Object.freeze({...this.lesson,learningLanguage:target,primaryLanguage:native});this._persist();this._speakCurrent();this._notify('languages');return this.lesson;
  }
  setPreference(key,value){
    if(!Object.hasOwn(DEFAULT_PREFERENCES,key))throw new Error('Unknown learning preference.');
    this._preferences={...this._preferences,[key]:!!value};saveStore(STORAGE.preferences,this._preferences);
    if(key==='repeat')this._speakCurrent();this._notify('preferences');return this._preferences;
  }
  getState(){return {lesson:this.lesson,entries:this.entries,current:this.current,preferences:{...this._preferences},basket:this._basket.slice(),learnedCount:this.learnedCount,total:this.total,complete:this.complete,isDefault:this.isDefault,active:this.active,exportableBasketCount:this.exportableBasketCount};}
  exportLesson({collectedOnly=false}={}){
    const entries=collectedOnly?this._currentPairBasket():this.entries;
    return {version:1,...(collectedOnly?{exportedCount:entries.length,omittedOtherLanguagePairs:this._basket.length-entries.length}:{}),title:collectedOnly?'Pinefall word basket':this.lesson.title,primaryLanguage:this.lesson.primaryLanguage,learningLanguage:this.lesson.learningLanguage,words:entries.map(entry=>({...entry}))};
  }
  clearBasket(){this._basket=[];saveStore(STORAGE.basket,this._basket);this._notify('basket');}
  replay(entry=this.current){
    if(!entry)return;this._finalSequence=false;this.audio.unlock();
    this.audio.playSequence([this._wordAudio(entry)],{manual:true,onEnd:()=>{if(this.active)this._speakCurrent();}});
  }
  setVolume(value){const wasSilent=this.audio.volume===0;this.audio.setVolume(value);if(wasSilent&&this.audio.volume>0&&this.active)this._speakCurrent();}
  setActive(value){const next=!!value;if(this.active===next){if(!next)this.audio.setActive(false);return;}this.active=next;this.audio.setActive(this.active);if(this.active)this._speakCurrent();else this._finalSequence=false;this._notify('active');}
  unlock(){this.audio.unlock();}
  dispose(){this.disposed=true;this.active=false;this.audio.dispose();this.bridge?.disconnect?.();}
}
