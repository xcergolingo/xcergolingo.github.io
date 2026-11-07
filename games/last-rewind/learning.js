/** GoLingo lesson normalization and deterministic, browser-independent learning state. */
export const LANGUAGES = [
  ['en','English'],['es','Español'],['zh','中文'],['ja','日本語'],['fr','Français'],['de','Deutsch'],
  ['it','Italiano'],['pt','Português'],['ko','한국어'],['vi','Tiếng Việt'],['ar','العربية'],
  ['hi','हिन्दी'],['ru','Русский'],['uk','Українська'],['th','ไทย']
].map(([code,name]) => ({code,name}));
export const LESSON_LIMIT = 500;
export const LESSON_TEXT_LIMIT = 200000;
const FIELDS = ['id','word','translation','sentence','sentenceTranslation','audioUrl','sentenceAudioUrl'];
const clean = (value, limit = 2000) => typeof value === 'string' || typeof value === 'number'
  ? String(value).replace(/\u0000/g,'').trim().slice(0,limit) : '';
const wordKey = value => clean(value).normalize('NFC').toLowerCase();
const recordKey = w => [w.word,w.translation,w.sentence,w.audioUrl,w.sentenceAudioUrl].map(value=>clean(value,12000).normalize('NFC')).join('\u001f');
const basketKey = (w, language) => `${language}\u001f${wordKey(w.word)}\u001f${wordKey(w.translation)}`;
const copyWord = word => Object.fromEntries(FIELDS.map(field => [field,word[field] || '']));
const first = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
const languageCode = (value, fallback) => {
  const code = clean(value,35).replace(/_/g,'-');
  return /^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(code) ? code : fallback;
};

/** URL validation only. Parsing a lesson never performs a network request. */
export function safeAudioUrl(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  // Reject overlong URLs rather than truncating a valid clip into a broken one.
  if (raw.length > 12000) return '';
  const text = raw;
  if (!text || /[\u0000-\u001f\u007f]/.test(text)) return '';
  if (/^data:audio\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*(?:;base64)?,/i.test(text)) return text;
  if (/^https?:\/\//i.test(text)) {
    try { const url = new URL(text); return url.hostname && !url.username && !url.password ? url.href : ''; } catch { return ''; }
  }
  if (/^blob:/i.test(text)) {
    try { const url = new URL(text); return url.protocol === 'blob:' ? text : ''; } catch { return ''; }
  }
  return '';
}

/** Segment words without splitting Chinese/Japanese/Thai into UTF-16 code units. */
export function tokenize(text, language = 'en') {
  const source = clean(text,4000);
  if (!source) return [];
  try {
    if (typeof globalThis.Intl?.Segmenter === 'function') {
      const segments = [...new globalThis.Intl.Segmenter(language,{granularity:'word'}).segment(source)];
      const words = segments.filter(part => part.isWordLike).map(part => part.segment.trim());
      if (words.length) return words.slice(0,LESSON_LIMIT);
    }
  } catch { /* Invalid/unavailable locale falls through to Unicode segmentation. */ }
  if (/\s/u.test(source) || !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}]/u.test(source)) {
    return (source.match(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu) || []).slice(0,LESSON_LIMIT);
  }
  try {
    if (typeof globalThis.Intl?.Segmenter === 'function') return [...new globalThis.Intl.Segmenter(language,{granularity:'grapheme'}).segment(source)].map(s=>s.segment).filter(s=>/[\p{L}\p{N}]/u.test(s)).slice(0,LESSON_LIMIT);
  } catch {}
  // Array.from walks Unicode code points, preserving surrogate pairs.
  return Array.from(source).filter(s=>/[\p{L}\p{N}]/u.test(s)).slice(0,LESSON_LIMIT);
}

function lineRecord(line) {
  const [left,...right] = clean(line,8000).split(/\s*[|\t]\s*/u);
  const text = clean(left,4000), translation = clean(right.join(' | '),4000);
  if (!text) return null;
  // A multiword vocabulary item (ice cream, por favor) keeps its own translation.
  const isSentence = /[.!?。！？।]\s*$/u.test(text);
  return isSentence ? {sentence:text,translation} : {word:text,translation};
}
function unwrap(input) {
  let value = input, inherited = {};
  for (let depth = 0; depth < 8; depth++) {
    if (typeof value === 'string') {
      if (value.length > LESSON_TEXT_LIMIT) throw new RangeError('Lesson text is limited to 200,000 characters.');
      const source = value.trim().replace(/^\uFEFF/,'');
      if (!source) return {value:[],inherited};
      if (/^[\[{]/.test(source)) {
        try { value = JSON.parse(source); continue; }
        catch { throw new Error('The lesson JSON is invalid. Check its brackets, commas, and quotation marks.'); }
      }
      return {value:source.split(/\r?\n/).map(lineRecord).filter(Boolean).slice(0,LESSON_LIMIT),inherited};
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) break;
    inherited = {...inherited,...Object.fromEntries(['primaryLanguage','learningLanguage','sourceLanguage','targetLanguage'].filter(key=>value[key]).map(key=>[key,value[key]]))};
    if (['words','sentences','phrases','items','entries'].some(key=>Array.isArray(value[key]))) break;
    if (value.payload !== undefined) { value = value.payload; continue; }
    if (value.data !== undefined) { value = value.data; continue; }
    break;
  }
  return {value,inherited};
}

export function normalizeLesson(input, {primaryLanguage='en',learningLanguage='es'} = {}) {
  if (typeof input !== 'string') {
    try { if (JSON.stringify(input)?.length > LESSON_TEXT_LIMIT) throw new RangeError('Lesson text is limited to 200,000 characters.'); }
    catch (error) { if (error instanceof RangeError) throw error; throw new Error('Lesson data must be a plain JSON object or text.'); }
  }
  const unwrapped = unwrap(input), raw = unwrapped.value;
  const root = Array.isArray(raw) ? {entries:raw} : raw && typeof raw === 'object' ? raw : {};
  const meta = {...unwrapped.inherited,...root};
  const primary = languageCode(first(meta.primaryLanguage,meta.sourceLanguage),languageCode(primaryLanguage,'en'));
  const learning = languageCode(first(meta.learningLanguage,meta.targetLanguage),languageCode(learningLanguage,'es'));
  const words = [], sentences = [], known = new Map(), dedup = new Map(), referenced = new Set();
  let budget = LESSON_TEXT_LIMIT - 2500, serial = 0;
  function canonicalWord(item, parent = null) {
    if (typeof item === 'string') {
      const pair = item.split(/\s*[|\t]\s*/u);
      item = {word:pair[0],translation:pair.slice(1).join(' | ')};
    }
    if (!item || typeof item !== 'object') return null;
    const text = clean(first(item.word,item.term,item.text,item.value),1000);
    if (!text) return null;
    const exact = known.get(wordKey(text));
    const sentence = clean(first(parent?.sentence,item.sentence,item.example),4000);
    const exactSentenceAudio = exact?.sentence === sentence ? exact?.sentenceAudioUrl : '';
    return {
      id:clean(first(item.id,`word-${++serial}`),100),word:text,
      translation:clean(first(item.translation,item.wordTranslation,item.meaning,exact?.translation),2000),
      sentence,
      sentenceTranslation:clean(first(parent?.translation,item.sentenceTranslation,item.exampleTranslation),4000),
      audioUrl:safeAudioUrl(first(item.audioUrl,item.audioURL,item.audio,item.wordAudioUrl,exact?.audioUrl)),
      sentenceAudioUrl:safeAudioUrl(first(parent?.audioUrl,item.sentenceAudioUrl,item.sentenceAudioURL,exactSentenceAudio)),
    };
  }
  function addWord(word) {
    if (!word) return null;
    const key = recordKey(word), existing = dedup.get(key);
    if (existing) return existing;
    const cost = JSON.stringify(word).length * 2 + 4; // A word may occur in both root words and its sentence.
    if (words.length >= LESSON_LIMIT || cost > budget) return null;
    budget -= cost; words.push(word); dedup.set(key,word);
    const keyExact = wordKey(word.word), previous = known.get(keyExact);
    if (!previous || (!previous.translation && word.translation)) known.set(keyExact,word);
    return word;
  }
  function addSentence(item, index) {
    if (typeof item === 'string') {
      const pair = item.split(/\s*[|\t]\s*/u);
      item = {sentence:pair[0],translation:pair.slice(1).join(' | ')};
    }
    if (!item || typeof item !== 'object') return;
    const sentence = clean(first(item.sentence,item.text,item.phrase),4000);
    const translation = clean(first(item.sentenceTranslation,item.translation,item.meaning),4000);
    const audioUrl = safeAudioUrl(first(item.sentenceAudioUrl,item.audioUrl,item.audioURL,item.audio));
    const id = clean(first(item.id,`sentence-${index+1}`),100);
    if (!sentence && !Array.isArray(item.words)) return;
    const cost = sentence.length + translation.length + id.length + 130;
    if (cost > budget || sentences.length >= LESSON_LIMIT) return;
    budget -= cost;
    const supplied = Array.isArray(item.words) ? item.words : Array.isArray(item.items) ? item.items : [];
    const entries = supplied.length ? supplied : tokenize(sentence,learning);
    const roundWords = [];
    for (const entry of entries.slice(0,LESSON_LIMIT)) {
      const word = addWord(canonicalWord(entry,{sentence,translation,audioUrl}));
      if (word) {
        // Repeated tokens share vocabulary metadata but still consume output space.
        const extraCost = referenced.has(word) ? JSON.stringify(word).length + 1 : 0;
        if (extraCost > budget) continue;
        budget -= extraCost; referenced.add(word); roundWords.push(word);
      }
    }
    if (roundWords.length) sentences.push({id,sentence,translation,words:roundWords});
  }

  // Index exact vocabulary first, but give explicit sentence rounds the entry budget.
  const vocabulary = [], mixedSentences = [];
  const explicit = Array.isArray(root.words) ? root.words : [];
  for (const item of explicit.slice(0,LESSON_LIMIT)) {
    const word=canonicalWord(item);if(word){vocabulary.push(word);known.set(wordKey(word.word),word);}
  }
  const mixed = [root.entries,root.items].find(Array.isArray) || [];
  for (let item of mixed.slice(0,LESSON_LIMIT)) {
    if (typeof item === 'string') item = lineRecord(item);
    if (item?.sentence && !item.word && !item.term) mixedSentences.push(item);
    else {const word=canonicalWord(item);if(word){vocabulary.push(word);known.set(wordKey(word.word),word);}}
  }
  const explicitSentences = Array.isArray(root.sentences) && root.sentences.length ? root.sentences
    : Array.isArray(root.phrases) && root.phrases.length ? root.phrases : mixedSentences;
  if (explicitSentences.length) {
    for (let i=0;i<Math.min(explicitSentences.length,LESSON_LIMIT);i++) addSentence(explicitSentences[i],i);
    for (const word of vocabulary) addWord(word);
    // Explicit sentences lead the lesson; additional supplied vocabulary remains playable.
    const used = new Set(sentences.flatMap(round=>round.words).map(word=>basketKey(word,learning)));
    const unused = words.filter(word=>!used.has(basketKey(word,learning)));
    for (let i=0;i<unused.length;i+=6) {
      if (budget < 140 || sentences.length >= LESSON_LIMIT) break;
      budget -= 140;
      sentences.push({id:`vocabulary-extra-${i/6+1}`,sentence:'',translation:'',words:unused.slice(i,i+6)});
    }
  } else {
    for (const word of vocabulary) addWord(word);
    // Word/example pairs become a sentence round without losing each word's own translation/audio.
    const grouped = new Map(), orphaned = [];
    for (const word of words) {
      if (!word.sentence) { orphaned.push(word); continue; }
      let round = grouped.get(word.sentence);
      if (!round) {
        round = {id:`sentence-${grouped.size+1}`,sentence:word.sentence,translation:word.sentenceTranslation,words:[]};
        grouped.set(word.sentence,round);
      }
      if (!round.translation && word.sentenceTranslation) round.translation = word.sentenceTranslation;
      round.words.push(word);
    }
    for (const round of grouped.values()) {
      const cost=round.sentence.length+round.translation.length+140;
      if(cost<=budget){budget-=cost;sentences.push(round);}
    }
    // Vocabulary-only rounds intentionally have no invented sentence or translation.
    for (let i=0;i<orphaned.length;i+=6) {
      if (budget < 140) break;
      budget -= 140;
      sentences.push({id:`vocabulary-${i/6+1}`,sentence:'',translation:'',words:orphaned.slice(i,i+6)});
    }
  }
  if (!words.length || !sentences.length) throw new Error('Add at least one word or sentence. You can paste word | translation on each line.');
  return {primaryLanguage:primary,learningLanguage:learning,words,sentences};
}

// Five original, parallel shop/survival phrases. Content vocabulary is supplied
// explicitly so translations never get guessed from a sentence-level translation.
const DEFAULTS = {
 en:{s:['The store is open.','Close the door.','I need more time.','The light is on.','Stay close to me.'],t:['store','open','close','door','I','need','more','time','light','on','stay','close to me'],w:[[[0,'store'],[1,'open']],[[2,'Close'],[3,'door']],[[4,'I'],[5,'need'],[6,'more'],[7,'time']],[[8,'light'],[9,'on']],[[10,'Stay'],[11,'close to me']]]},
 es:{s:['La tienda está abierta.','Cierra la puerta.','Necesito más tiempo.','La luz está encendida.','Quédate cerca de mí.'],t:['tienda','abierta','cierra','puerta','yo','necesito','más','tiempo','luz','encendida','quédate','cerca de mí'],w:[[[0,'tienda'],[1,'abierta']],[[2,'Cierra'],[3,'puerta']],[[5,'Necesito'],[6,'más'],[7,'tiempo']],[[8,'luz'],[9,'encendida']],[[10,'Quédate'],[11,'cerca de mí']]]},
 zh:{s:['商店开门了。','关上门。','我需要更多时间。','灯亮着。','待在我身边。'],t:['商店','开门','关上','门','我','需要','更多','时间','灯','亮着','待在','我身边'],w:[[[0,'商店'],[1,'开门']],[[2,'关上'],[3,'门']],[[4,'我'],[5,'需要'],[6,'更多'],[7,'时间']],[[8,'灯'],[9,'亮着']],[[10,'待在'],[11,'我身边']]]},
 ja:{s:['店は開いています。','ドアを閉めてください。','もっと時間が必要です。','明かりがついています。','私のそばにいてください。'],t:['店','開いています','閉めてください','ドア','私','必要','もっと','時間','明かり','ついています','いてください','私のそばに'],w:[[[0,'店'],[1,'開いています']],[[3,'ドア'],[2,'閉めてください']],[[6,'もっと'],[7,'時間'],[5,'必要']],[[8,'明かり'],[9,'ついています']],[[11,'私のそばに'],[10,'いてください']]]},
 fr:{s:['Le magasin est ouvert.','Ferme la porte.','J’ai besoin de plus de temps.','La lumière est allumée.','Reste près de moi.'],t:['magasin','ouvert','ferme','porte','je','besoin','plus','temps','lumière','allumée','reste','près de moi'],w:[[[0,'magasin'],[1,'ouvert']],[[2,'Ferme'],[3,'porte']],[[5,'besoin'],[6,'plus'],[7,'temps']],[[8,'lumière'],[9,'allumée']],[[10,'Reste'],[11,'près de moi']]]},
 de:{s:['Der Laden ist offen.','Schließe die Tür.','Ich brauche mehr Zeit.','Das Licht ist an.','Bleib in meiner Nähe.'],t:['Laden','offen','schließe','Tür','ich','brauche','mehr','Zeit','Licht','an','bleib','in meiner Nähe'],w:[[[0,'Laden'],[1,'offen']],[[2,'Schließe'],[3,'Tür']],[[4,'Ich'],[5,'brauche'],[6,'mehr'],[7,'Zeit']],[[8,'Licht'],[9,'an']],[[10,'Bleib'],[11,'in meiner Nähe']]]},
 it:{s:['Il negozio è aperto.','Chiudi la porta.','Ho bisogno di più tempo.','La luce è accesa.','Resta vicino a me.'],t:['negozio','aperto','chiudi','porta','io','bisogno','più','tempo','luce','accesa','resta','vicino a me'],w:[[[0,'negozio'],[1,'aperto']],[[2,'Chiudi'],[3,'porta']],[[5,'bisogno'],[6,'più'],[7,'tempo']],[[8,'luce'],[9,'accesa']],[[10,'Resta'],[11,'vicino a me']]]},
 pt:{s:['A loja está aberta.','Feche a porta.','Preciso de mais tempo.','A luz está acesa.','Fique perto de mim.'],t:['loja','aberta','feche','porta','eu','preciso','mais','tempo','luz','acesa','fique','perto de mim'],w:[[[0,'loja'],[1,'aberta']],[[2,'Feche'],[3,'porta']],[[5,'Preciso'],[6,'mais'],[7,'tempo']],[[8,'luz'],[9,'acesa']],[[10,'Fique'],[11,'perto de mim']]]},
 ko:{s:['가게가 열려 있어요.','문을 닫아 주세요.','시간이 더 필요해요.','불이 켜져 있어요.','제 곁에 있어 주세요.'],t:['가게','열려 있어요','닫아 주세요','문','저','필요해요','더','시간','불','켜져 있어요','있어 주세요','제 곁에'],w:[[[0,'가게'],[1,'열려 있어요']],[[3,'문'],[2,'닫아 주세요']],[[7,'시간'],[6,'더'],[5,'필요해요']],[[8,'불'],[9,'켜져 있어요']],[[11,'제 곁에'],[10,'있어 주세요']]]},
 vi:{s:['Cửa hàng đang mở.','Đóng cửa lại.','Tôi cần thêm thời gian.','Đèn đang bật.','Ở lại gần tôi.'],t:['cửa hàng','mở','đóng','cửa','tôi','cần','thêm','thời gian','đèn','bật','ở lại','gần tôi'],w:[[[0,'Cửa hàng'],[1,'mở']],[[2,'Đóng'],[3,'cửa']],[[4,'Tôi'],[5,'cần'],[6,'thêm'],[7,'thời gian']],[[8,'Đèn'],[9,'bật']],[[10,'Ở lại'],[11,'gần tôi']]]},
 ar:{s:['المتجر مفتوح.','أغلق الباب.','أحتاج إلى مزيد من الوقت.','الضوء مضاء.','ابقَ بالقرب مني.'],t:['المتجر','مفتوح','أغلق','الباب','أنا','أحتاج','مزيد','الوقت','الضوء','مضاء','ابقَ','بالقرب مني'],w:[[[0,'المتجر'],[1,'مفتوح']],[[2,'أغلق'],[3,'الباب']],[[5,'أحتاج'],[6,'مزيد'],[7,'الوقت']],[[8,'الضوء'],[9,'مضاء']],[[10,'ابقَ'],[11,'بالقرب مني']]]},
 hi:{s:['दुकान खुली है।','दरवाज़ा बंद करो।','मुझे और समय चाहिए।','बत्ती जल रही है।','मेरे पास रहो।'],t:['दुकान','खुली','बंद करो','दरवाज़ा','मैं','चाहिए','और','समय','बत्ती','जल रही है','रहो','मेरे पास'],w:[[[0,'दुकान'],[1,'खुली']],[[3,'दरवाज़ा'],[2,'बंद करो']],[[6,'और'],[7,'समय'],[5,'चाहिए']],[[8,'बत्ती'],[9,'जल रही है']],[[11,'मेरे पास'],[10,'रहो']]]},
 ru:{s:['Магазин открыт.','Закрой дверь.','Мне нужно больше времени.','Свет включён.','Оставайся рядом со мной.'],t:['магазин','открыт','закрой','дверь','я','нужно','больше','время','свет','включён','оставайся','рядом со мной'],w:[[[0,'Магазин'],[1,'открыт']],[[2,'Закрой'],[3,'дверь']],[[5,'нужно'],[6,'больше'],[7,'времени']],[[8,'Свет'],[9,'включён']],[[10,'Оставайся'],[11,'рядом со мной']]]},
 uk:{s:['Магазин відчинений.','Зачини двері.','Мені потрібно більше часу.','Світло ввімкнене.','Залишайся поруч зі мною.'],t:['магазин','відчинений','зачини','двері','я','потрібно','більше','час','світло','ввімкнене','залишайся','поруч зі мною'],w:[[[0,'Магазин'],[1,'відчинений']],[[2,'Зачини'],[3,'двері']],[[5,'потрібно'],[6,'більше'],[7,'часу']],[[8,'Світло'],[9,'ввімкнене']],[[10,'Залишайся'],[11,'поруч зі мною']]]},
 th:{s:['ร้านเปิดอยู่','ปิดประตู','ฉันต้องการเวลาเพิ่ม','ไฟเปิดอยู่','อยู่ใกล้ฉัน'],t:['ร้าน','เปิดอยู่','ปิด','ประตู','ฉัน','ต้องการ','เพิ่ม','เวลา','ไฟ','เปิดอยู่','อยู่','ใกล้ฉัน'],w:[[[0,'ร้าน'],[1,'เปิดอยู่']],[[2,'ปิด'],[3,'ประตู']],[[4,'ฉัน'],[5,'ต้องการ'],[7,'เวลา'],[6,'เพิ่ม']],[[8,'ไฟ'],[9,'เปิดอยู่']],[[10,'อยู่'],[11,'ใกล้ฉัน']]]},
};
export function defaultLesson(primary='en', learning='es') {
  const p = languageCode(primary,'en'), l = languageCode(learning,'es');
  const source = DEFAULTS[p.split('-')[0]], target = DEFAULTS[l.split('-')[0]];
  if (!source || !target) throw new Error('That language has no built-in sample. Paste your own lesson for it.');
  return normalizeLesson({primaryLanguage:p,learningLanguage:l,sentences:target.s.map((sentence,i)=>({
    id:`sample-${l}-${i+1}`,sentence,translation:source.s[i],
    words:target.w[i].map(([concept,word],j)=>({id:`sample-${l}-${i+1}-${j+1}`,word,translation:source.t[concept]}))
  }))});
}

export class LearningSession {
  constructor(lesson = defaultLesson(), rng = Math.random) {
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this.basket = []; this._basketMap = new Map(); this._lastFirst = '';
    this.setLesson(lesson);
  }
  setLesson(lesson) {
    this.lesson = normalizeLesson(lesson);
    this._lastFirst = ''; this.clearBasket();
    return this.reset({shuffle:true});
  }
  reset({shuffle=true,clearBasket=false} = {}) {
    if (clearBasket) this.clearBasket();
    this.rounds = this.lesson.sentences.map(round => ({...round,words:round.words.map(copyWord)}));
    if (shuffle) {
      for (let i=this.rounds.length-1;i>0;i--) {
        const value=Number(this.rng()), fraction=Number.isFinite(value)?Math.max(0,Math.min(.999999999,value)):0;
        const j=Math.floor(fraction*(i+1));[this.rounds[i],this.rounds[j]]=[this.rounds[j],this.rounds[i]];
      }
      if (this.rounds.length>1 && this.rounds[0].id===this._lastFirst) this.rounds.push(this.rounds.shift());
    }
    this._lastFirst=this.rounds[0]?.id||'';
    this.currentRound=null;this.currentWord=null;this._wordIndex=0;this.wave=0;
    return this;
  }
  startWave(wave) {
    const n=Math.max(1,Math.floor(Number(wave)||1));
    this.wave=n;this._wordIndex=0;this.currentWord=null;
    this.currentRound=this.rounds[(n-1)%this.rounds.length]||null;
    return this.currentRound;
  }
  collectNext() {
    const words=this.currentRound?.words;if(!words?.length)return null;
    const word=copyWord(words[this._wordIndex++%words.length]);this.currentWord=word;
    const key=basketKey(word,this.lesson.learningLanguage),old=this._basketMap.get(key);
    if(old){old.count=Math.min(999999,(old.count||1)+1);old.reviews=old.count;}
    else if(this.basket.length<LESSON_LIMIT){const entry={...word,count:1,reviews:1};this.basket.push(entry);this._basketMap.set(key,entry);}
    return word;
  }
  completeWave(){return this.currentRound;}
  clearBasket(){this.basket=[];this._basketMap=new Map();return this;}
  restoreBasket(input) {
    // A persisted export must match this pair. Bare arrays belong to this active lesson.
    const payload=Array.isArray(input)?{words:input}:input;
    if(!payload||typeof payload!=='object')return this;
    if(payload.learningLanguage&&wordKey(payload.learningLanguage)!==wordKey(this.lesson.learningLanguage))return this;
    if(payload.primaryLanguage&&wordKey(payload.primaryLanguage)!==wordKey(this.lesson.primaryLanguage))return this;
    if(!Array.isArray(payload.words))return this;
    for(const item of payload.words.slice(0,LESSON_LIMIT)){
      if(!item||typeof item!=='object'||!clean(item.word))continue;
      const word={id:clean(item.id,100)||`review-${this.basket.length+1}`,word:clean(item.word,1000),translation:clean(item.translation),sentence:clean(item.sentence,4000),sentenceTranslation:clean(item.sentenceTranslation,4000),audioUrl:safeAudioUrl(item.audioUrl),sentenceAudioUrl:safeAudioUrl(item.sentenceAudioUrl)};
      const key=basketKey(word,this.lesson.learningLanguage),old=this._basketMap.get(key);
      const count=Math.max(1,Math.min(999999,Math.floor(Number(item.count||item.reviews)||1)));
      if(old){old.count=Math.max(old.count,count);old.reviews=old.count;}
      else if(this.basket.length<LESSON_LIMIT){const entry={...word,count,reviews:count};this.basket.push(entry);this._basketMap.set(key,entry);}
    }
    return this;
  }
  get reviewCount(){return this.basket.length;}
  get totalCollections(){return this.basket.reduce((sum,w)=>sum+(w.count||1),0);}
  // Native GoLingo exports stay canonical. Local persistence may opt into review counts.
  exportPayload({includeReviewCounts=false}={}){return{primaryLanguage:this.lesson.primaryLanguage,learningLanguage:this.lesson.learningLanguage,words:this.basket.map(word=>includeReviewCounts?{...copyWord(word),count:word.count||1,reviews:word.count||1}:copyWord(word))};}
}
