/** Pure GoLingo lesson data helpers. All learning text remains plain text. */
const MAX_BYTES = 100_000;
const MAX_ENTRIES = 500;

export const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish · Español' },
  { code: 'zh', name: 'Chinese · 中文' },
  { code: 'ja', name: 'Japanese · 日本語' },
  { code: 'fr', name: 'French · Français' },
  { code: 'de', name: 'German · Deutsch' },
  { code: 'it', name: 'Italian · Italiano' },
  { code: 'pt', name: 'Portuguese · Português' },
  { code: 'ko', name: 'Korean · 한국어' },
  { code: 'vi', name: 'Vietnamese · Tiếng Việt' },
  { code: 'ru', name: 'Russian · Русский' },
  { code: 'ar', name: 'Arabic · العربية' },
  { code: 'hi', name: 'Hindi · हिन्दी' },
  { code: 'th', name: 'Thai · ไทย' },
  { code: 'uk', name: 'Ukrainian · Українська' }
].map(Object.freeze));

const aliases = Object.assign(Object.create(null), {
  en:'en', english:'en', 英语:'en', 英語:'en', es:'es', spanish:'es', español:'es', espanol:'es', 西班牙语:'es',
  zh:'zh', cn:'zh', chinese:'zh', mandarin:'zh', 中文:'zh', 汉语:'zh', 漢語:'zh', 普通话:'zh', 普通話:'zh',
  'simplified chinese':'zh', 'chinese (simplified)':'zh', 简体中文:'zh', 'traditional chinese':'zh-Hant', 'chinese (traditional)':'zh-Hant', 繁體中文:'zh-Hant',
  ja:'ja', jp:'ja', japanese:'ja', 日本語:'ja', 日语:'ja', 日語:'ja',
  fr:'fr', french:'fr', français:'fr', francais:'fr', 法语:'fr',
  de:'de', german:'de', deutsch:'de', 德语:'de',
  it:'it', italian:'it', italiano:'it', 意大利语:'it',
  pt:'pt', portuguese:'pt', português:'pt', portugues:'pt', 葡萄牙语:'pt',
  ko:'ko', kr:'ko', korean:'ko', 한국어:'ko', 韩语:'ko', 韓語:'ko',
  vi:'vi', vn:'vi', vietnamese:'vi', 'tiếng việt':'vi', 'tieng viet':'vi', 越南语:'vi',
  ru:'ru', russian:'ru', русский:'ru', 俄语:'ru',
  ar:'ar', arabic:'ar', العربية:'ar', 阿拉伯语:'ar',
  hi:'hi', hindi:'hi', हिन्दी:'hi', हिंदी:'hi', 印地语:'hi',
  th:'th', thai:'th', ไทย:'th', 泰语:'th',
  uk:'uk', ua:'uk', ukrainian:'uk', українська:'uk', 乌克兰语:'uk'
});

function text(value) {
  if (typeof value === 'string') return value.replace(/^\uFEFF/, '').trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}
function firstText(...values) { for (const value of values) { const s = text(value); if (s) return s; } return ''; }
function language(value, fallback, label) {
  const raw = firstText(value, fallback).replaceAll('_', '-');
  const lowered = raw.toLocaleLowerCase('en');
  const aliased = aliases[lowered] || aliases[lowered.split(' · ')[0]];
  if (aliased) return aliased;
  if (!/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(raw)) {
    throw new Error(`Choose a valid ${label} language, such as es, ja, or zh.`);
  }
  try { return Intl.getCanonicalLocales(raw)[0]; }
  catch { throw new Error(`The ${label} language “${raw}” is not a valid language code.`); }
}
function bytes(value) { return new TextEncoder().encode(value).byteLength; }
function checkSize(input) {
  let encoded;
  try { encoded = typeof input === 'string' ? input : JSON.stringify(input); }
  catch { throw new Error('This lesson cannot be read. Use JSON without circular references.'); }
  if (typeof encoded !== 'string') throw new Error('Paste a lesson as JSON or as one word per line.');
  if (bytes(encoded) > MAX_BYTES) throw new Error('This lesson is too large. Keep it under 100 KB and 500 entries.');
}
function hash(value) {
  // Stable FNV-1a over Unicode code points; no browser storage or randomness.
  let h = 0x811c9dc5;
  for (const ch of value) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
function parseText(input) {
  const s = input.replace(/^\uFEFF/, '').trim();
  if (!s) throw new Error('Add at least one word or sentence to start a lesson.');
  if (/^[\[{"]/.test(s)) {
    try { return JSON.parse(s); }
    catch { throw new Error('The JSON is not valid. Check its quotes, commas, and brackets, or use “word | translation” on each line.'); }
  }
  return s.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}
function audioText(value) {
  return typeof value === 'object' && value !== null ? firstText(value.url, value.src) : text(value);
}
function signature(entry) {
  return JSON.stringify([entry.word, entry.translation, entry.sentence, entry.sentenceTranslation, entry.audioUrl || '', entry.sentenceAudioUrl || '']);
}
function normalizeEntry(value, forceSentence, index, kind, languages, usedIds) {
  let row = value;
  if (typeof row === 'string' || typeof row === 'number') {
    const parts = typeof row === 'number' ? [String(row)] : row.split(/\s*\|\s*|\t/).map(s => s.trim());
    if (parts.length > 4) throw new Error(`Entry ${index + 1} has too many columns. Use word | translation | sentence | sentence translation.`);
    row = { word: parts[0], translation: parts[1] || '', sentence: parts[2] || '', sentenceTranslation: parts[3] || '' };
  } else if (Array.isArray(row)) {
    if (row.length > 4) throw new Error(`Entry ${index + 1} has too many values. Each row can contain a word, translation, sentence, and sentence translation.`);
    row = { word: row[0], translation: row[1], sentence: row[2], sentenceTranslation: row[3] };
  }
  if (!row || typeof row !== 'object') throw new Error(`Entry ${index + 1} needs a word or a sentence.`);
  const explicitWord = firstText(row.word, row.term, row.text, row.learningText, row.targetText, row.phrase);
  const fullSentence = firstText(row.sentence, row.exampleSentence, row.example);
  const isSentence = forceSentence || (!explicitWord && !!fullSentence);
  const word = isSentence ? firstText(fullSentence, explicitWord) : explicitWord;
  if (!word) throw new Error(`Entry ${index + 1} has no learning text. Add a “word”, “text”, or “sentence” value.`);
  const translated = firstText(row.translation, row.meaning, row.translatedText, row.primaryText, row.definition);
  const translatedSentence = firstText(row.sentenceTranslation, row.exampleTranslation, row.phraseTranslation);
  const entry = {
    id: '', word,
    translation: isSentence ? firstText(translatedSentence, translated) : translated,
    sentence: isSentence ? word : fullSentence,
    sentenceTranslation: isSentence ? firstText(translatedSentence, translated) : translatedSentence
  };
  // An exact full-sentence entry can safely reuse its supplied translation.
  // Never infer translations for individual tokens from a sentence translation.
  if (entry.sentence === entry.word && !entry.sentenceTranslation) entry.sentenceTranslation = entry.translation;
  const suppliedAudio = firstText(audioText(row.audioUrl), audioText(row.audioURL), audioText(row.audio), audioText(row.wordAudioUrl), audioText(row.pronunciationAudioUrl));
  const suppliedSentenceAudio = firstText(audioText(row.sentenceAudioUrl), audioText(row.sentenceAudioURL), audioText(row.sentenceAudio));
  const wordAudio = isSentence ? firstText(suppliedSentenceAudio, suppliedAudio) : suppliedAudio;
  if (wordAudio) entry.audioUrl = wordAudio;
  const sentenceAudio = isSentence ? firstText(suppliedSentenceAudio, suppliedAudio) : suppliedSentenceAudio;
  if (sentenceAudio) entry.sentenceAudioUrl = sentenceAudio;
  const sig = signature(entry);
  const suppliedId = firstText(row.id, row.wordId, row.sentenceId);
  const base = suppliedId || `${isSentence || forceSentence ? 's' : 'w'}-${hash(languages.learningLanguage + '\u001f' + languages.primaryLanguage + '\u001f' + sig)}`;
  let id = base;
  const previous = usedIds.get(id);
  // A sentence-only normalized lesson intentionally has the same logical
  // entries in words and sentences. Preserve their IDs on a second normalize.
  if (previous && !(!previous.kinds.has(kind) && previous.sig === sig)) {
    id = `${base}-${hash(sig)}`;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${hash(sig)}-${suffix++}`;
  }
  entry.id = id;
  if (!usedIds.has(id)) usedIds.set(id, { kinds:new Set([kind]), sig });
  else usedIds.get(id).kinds.add(kind);
  return entry;
}

/**
 * Normalize GoLingo JSON, wrappers, arrays, or one “word | translation” per line.
 * words is the complete playable deck: word rows plus standalone sentences.
 * sentences retains those full-sentence entries; word example sentences are not
 * added as extra practice items. Sentence text is never tokenized or translated.
 */
export function normalizeLesson(input, defaults = {}) {
  checkSize(input);
  const inherited = {
    learningLanguage: defaults.learningLanguage || 'es',
    primaryLanguage: defaults.primaryLanguage || defaults.translationLanguage || 'en'
  };
  let body = input;
  for (let depth = 0; depth < 10; depth++) {
    if (typeof body === 'string') { body = parseText(body); continue; }
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if (text(body.learningLanguage)) inherited.learningLanguage = body.learningLanguage;
      if (firstText(body.primaryLanguage, body.translationLanguage)) inherited.primaryLanguage = firstText(body.primaryLanguage, body.translationLanguage);
      if (Object.prototype.hasOwnProperty.call(body, 'lesson')) { body = body.lesson; continue; }
      if (Object.prototype.hasOwnProperty.call(body, 'payload')) { body = body.payload; continue; }
    }
    break;
  }
  if (typeof body === 'string') throw new Error('This lesson has too many nested wrappers. Paste its words or sentences directly.');
  if (!body || typeof body !== 'object') throw new Error('A lesson needs a list of words or sentences.');
  const languages = {
    learningLanguage: language(inherited.learningLanguage, 'es', 'learning'),
    primaryLanguage: language(inherited.primaryLanguage, 'en', 'translation')
  };
  const groups = [];
  if (Array.isArray(body)) groups.push({ key:'entries', kind:'word', rows:body });
  else {
    for (const key of ['words','items','entries','sentences','phrases']) {
      if (!Object.prototype.hasOwnProperty.call(body, key) || body[key] == null) continue;
      if (!Array.isArray(body[key])) throw new Error(`“${key}” must be a list, for example "${key}": [{"word":"hola","translation":"hello"}].`);
      groups.push({key, kind:key === 'sentences' || key === 'phrases' ? 'sentence' : 'word', rows:body[key]});
    }
    if (!groups.length && firstText(body.word,body.term,body.text,body.sentence,body.phrase)) groups.push({key:'entries',kind:'word',rows:[body]});
  }
  const total = groups.reduce((n,g) => n + g.rows.length, 0);
  // Full sentences also appear in words after normalization. Count these exact
  // logical aliases once on a second normalize, without excusing duplicate rows.
  let aliasCount = 0;
  if (!Array.isArray(body) && Array.isArray(body.words) && Array.isArray(body.sentences)) {
    const wordAliases = new Map(body.words.filter(row => row && row.id && row.word && row.word === row.sentence).map(row => [String(row.id),signature(row)]));
    const counted = new Set();
    for (const row of body.sentences) {
      if (row && row.id && !counted.has(String(row.id)) && wordAliases.get(String(row.id)) === signature(row)) {
        aliasCount++; counted.add(String(row.id));
      }
    }
  }
  if (total - aliasCount > MAX_ENTRIES) throw new Error('This lesson has too many entries. Use 500 words and sentences or fewer.');
  const usedIds = new Map(), words = [], sentences = [];
  let rowIndex = 0;
  for (const group of groups) {
    for (const row of group.rows) {
      const index = rowIndex++;
      if (row == null || typeof row === 'string' && !row.trim()) continue;
      const entry = normalizeEntry(row, group.kind === 'sentence', index, group.kind, languages, usedIds);
      if (group.kind === 'sentence') sentences.push(entry);
      else words.push(entry);
    }
  }
  if (!words.length && !sentences.length) throw new Error('Add at least one word or sentence to start a lesson.');
  if (!sentences.length) {
    for (const entry of words) if (entry.word === entry.sentence && entry.sentence) sentences.push({...entry});
  }
  const playable = words.slice();
  const playableIds = new Map(playable.map(entry => [entry.id,signature(entry)]));
  for (const entry of sentences) {
    if (playableIds.get(entry.id) === signature(entry)) continue;
    playable.push({...entry}); playableIds.set(entry.id,signature(entry));
  }
  return { ...languages, words:playable, sentences };
}

/** A shuffled copy; the lesson and its entries are never mutated. */
export function shuffleEntries(entries, random = Math.random) {
  if (!Array.isArray(entries)) throw new Error('A deck needs a list of lesson entries.');
  const deck = entries.map(entry => entry && typeof entry === 'object' ? {...entry} : entry);
  for (let i = deck.length - 1; i > 0; i--) {
    const sample = random();
    if (typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('The shuffle random function must return a number from 0 up to, but not including, 1.');
    const j = Math.floor(sample * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Import limits apply to the original payload. A normalized sentence-only
// lesson contains intentional words/sentences aliases and repeated full text;
// do not reject that accepted lesson merely because its internal form is larger.
function normalizedView(lesson) {
  if (lesson && typeof lesson === 'object' && !Array.isArray(lesson)
      && typeof lesson.learningLanguage === 'string' && typeof lesson.primaryLanguage === 'string'
      && Array.isArray(lesson.words) && Array.isArray(lesson.sentences)
      && lesson.words.length > 0 && lesson.words.length <= MAX_ENTRIES && lesson.sentences.length <= MAX_ENTRIES) {
    const logical = new Map();
    let valid = true;
    for (const list of [lesson.words,lesson.sentences]) {
      const ids = new Set();
      for (const entry of list) {
        if (!entry || !['id','word','translation','sentence','sentenceTranslation'].every(key => typeof entry[key] === 'string')
            || !entry.id || !entry.word || ids.has(entry.id)
            || entry.audioUrl !== undefined && typeof entry.audioUrl !== 'string'
            || entry.sentenceAudioUrl !== undefined && typeof entry.sentenceAudioUrl !== 'string') { valid = false; break; }
        ids.add(entry.id);
        const sig = signature(entry);
        if (logical.has(entry.id) && logical.get(entry.id) !== sig) { valid = false; break; }
        logical.set(entry.id,sig);
      }
      if (!valid) break;
    }
    if (valid && logical.size <= MAX_ENTRIES) return lesson;
  }
  return normalizeLesson(lesson);
}

/** Order-independent fingerprint scopes a collection to language pair + content. */
export function lessonFingerprint(lesson) {
  const normalized = normalizedView(lesson);
  const canonical = entry => JSON.stringify([entry.id,entry.word,entry.translation,entry.sentence,entry.sentenceTranslation,entry.audioUrl || '',entry.sentenceAudioUrl || '']);
  return `golingo-${hash(JSON.stringify([normalized.primaryLanguage,normalized.learningLanguage,normalized.words.map(canonical).sort(),normalized.sentences.map(canonical).sort()]))}`;
}

/** Export only the selected/collected entries in the canonical GoLingo schema. */
export function buildExport(lesson, collectedEntries = []) {
  const normalized = normalizedView(lesson);
  if (!Array.isArray(collectedEntries)) throw new Error('Choose a list of collected entries to export.');
  if (collectedEntries.length > MAX_ENTRIES) throw new Error('Export 500 collected entries or fewer.');
  const lookup = new Map([...normalized.words,...normalized.sentences].map(entry => [entry.id,entry]));
  const selected = [], seen = new Set(), usedIds = new Map();
  for (let i=0;i<collectedEntries.length;i++) {
    let value = collectedEntries[i];
    if (typeof value === 'string' && lookup.has(value)) value = lookup.get(value);
    if (value && typeof value === 'object' && value.entry) value = value.entry;
    if (value && typeof value === 'object' && value.id && lookup.has(String(value.id))) value = lookup.get(String(value.id));
    const entry = normalizeEntry(value,false,i,'word',normalized,usedIds);
    const key = firstText(value && value.id, hash(signature(entry))) + '\u001f' + signature(entry);
    if (seen.has(key)) continue;
    seen.add(key); selected.push(entry);
  }
  return { primaryLanguage:normalized.primaryLanguage, learningLanguage:normalized.learningLanguage, words:selected };
}

// Each column is the same concept across all 15 languages; example translations
// therefore come from supplied parallel sentences, never from inferred tokens.
const CONCEPTS = ['hello','thanks','water','friend','book','door','street','ready','help','forward'];
const STARTERS = {
  en: [
    ['hello','Hello, my friend.'],['thank you','Thank you for your help.'],['water','I drink water.'],['friend','My friend is here.'],['book','I read a book.'],['door','Open the door, please.'],['street','This street is quiet.'],['ready','I am ready.'],['help','Can you help me?'],['forward',"Let's move forward."]
  ],
  es: [
    ['hola','Hola, amigo mío.'],['gracias','Gracias por tu ayuda.'],['agua','Bebo agua.'],['amigo','Mi amigo está aquí.'],['libro','Leo un libro.'],['puerta','Abre la puerta, por favor.'],['calle','Esta calle es tranquila.'],['listo','Estoy listo.'],['ayuda','¿Puedes ayudarme?'],['adelante','Vamos hacia adelante.']
  ],
  zh: [
    ['你好','你好，我的朋友。'],['谢谢','谢谢你的帮助。'],['水','我喝水。'],['朋友','我的朋友在这里。'],['书','我读一本书。'],['门','请开门。'],['街道','这条街道很安静。'],['准备好','我准备好了。'],['帮助','你能帮助我吗？'],['向前','我们向前走吧。']
  ],
  'zh-Hant': [
    ['你好','你好，我的朋友。'],['謝謝','謝謝你的幫助。'],['水','我喝水。'],['朋友','我的朋友在這裡。'],['書','我讀一本書。'],['門','請開門。'],['街道','這條街道很安靜。'],['準備好','我準備好了。'],['幫助','你能幫助我嗎？'],['向前','我們向前走吧。']
  ],
  ja: [
    ['こんにちは','こんにちは、友よ。'],['ありがとう','手伝ってくれてありがとう。'],['水','水を飲みます。'],['友達','友達はここにいます。'],['本','本を読みます。'],['ドア','ドアを開けてください。'],['通り','この通りは静かです。'],['準備ができた','準備ができました。'],['助け','手伝ってくれますか？'],['前へ','前へ進みましょう。']
  ],
  fr: [
    ['bonjour','Bonjour, mon ami.'],['merci','Merci pour ton aide.'],['eau',"Je bois de l’eau."],['ami','Mon ami est ici.'],['livre','Je lis un livre.'],['porte',"Ouvre la porte, s’il te plaît."],['rue','Cette rue est calme.'],['prêt','Je suis prêt.'],['aide',"Peux-tu m’aider ?"],['en avant',"Allons de l’avant."]
  ],
  de: [
    ['hallo','Hallo, mein Freund.'],['danke','Danke für deine Hilfe.'],['Wasser','Ich trinke Wasser.'],['Freund','Mein Freund ist hier.'],['Buch','Ich lese ein Buch.'],['Tür','Öffne bitte die Tür.'],['Straße','Diese Straße ist ruhig.'],['bereit','Ich bin bereit.'],['Hilfe','Kannst du mir helfen?'],['vorwärts','Gehen wir vorwärts.']
  ],
  it: [
    ['ciao','Ciao, amico mio.'],['grazie','Grazie per il tuo aiuto.'],['acqua',"Bevo acqua."],['amico','Il mio amico è qui.'],['libro','Leggo un libro.'],['porta','Apri la porta, per favore.'],['strada','Questa strada è tranquilla.'],['pronto','Sono pronto.'],['aiuto','Puoi aiutarmi?'],['avanti','Andiamo avanti.']
  ],
  pt: [
    ['olá','Olá, meu amigo.'],['obrigado','Obrigado pela sua ajuda.'],['água','Eu bebo água.'],['amigo','Meu amigo está aqui.'],['livro','Eu leio um livro.'],['porta','Abra a porta, por favor.'],['rua','Esta rua é tranquila.'],['pronto','Estou pronto.'],['ajuda','Você pode me ajudar?'],['em frente','Vamos em frente.']
  ],
  ko: [
    ['안녕하세요','안녕하세요, 친구여.'],['감사합니다','도와주셔서 감사합니다.'],['물','물을 마셔요.'],['친구','제 친구가 여기 있어요.'],['책','책을 읽어요.'],['문','문을 열어 주세요.'],['거리','이 거리는 조용해요.'],['준비된','준비됐어요.'],['도움','도와주실 수 있나요?'],['앞으로','앞으로 나아가요.']
  ],
  vi: [
    ['xin chào','Xin chào, bạn của tôi.'],['cảm ơn','Cảm ơn bạn đã giúp đỡ.'],['nước','Tôi uống nước.'],['bạn','Bạn của tôi ở đây.'],['sách','Tôi đọc một cuốn sách.'],['cửa','Làm ơn mở cửa.'],['đường','Con đường này yên tĩnh.'],['sẵn sàng','Tôi đã sẵn sàng.'],['giúp đỡ','Bạn có thể giúp tôi không?'],['tiến lên','Chúng ta hãy tiến lên.']
  ],
  ru: [
    ['привет','Привет, мой друг.'],['спасибо','Спасибо за твою помощь.'],['вода','Я пью воду.'],['друг','Мой друг здесь.'],['книга','Я читаю книгу.'],['дверь','Открой дверь, пожалуйста.'],['улица','Эта улица тихая.'],['готов','Я готов.'],['помощь','Можешь мне помочь?'],['вперёд','Давайте двигаться вперёд.']
  ],
  ar: [
    ['مرحبًا','مرحبًا يا صديقي.'],['شكرًا','شكرًا على مساعدتك.'],['ماء','أشرب الماء.'],['صديق','صديقي هنا.'],['كتاب','أقرأ كتابًا.'],['باب','افتح الباب من فضلك.'],['شارع','هذا الشارع هادئ.'],['جاهز','أنا جاهز.'],['مساعدة','هل يمكنك مساعدتي؟'],['إلى الأمام','لنتقدم إلى الأمام.']
  ],
  hi: [
    ['नमस्ते','नमस्ते, मेरे दोस्त।'],['धन्यवाद','आपकी मदद के लिए धन्यवाद।'],['पानी','मैं पानी पीता हूँ।'],['दोस्त','मेरा दोस्त यहाँ है।'],['किताब','मैं किताब पढ़ता हूँ।'],['दरवाज़ा','कृपया दरवाज़ा खोलिए।'],['सड़क','यह सड़क शांत है।'],['तैयार','मैं तैयार हूँ।'],['मदद','क्या आप मेरी मदद कर सकते हैं?'],['आगे','चलो आगे बढ़ें।']
  ],
  th: [
    ['สวัสดี','สวัสดีเพื่อนของฉัน'],['ขอบคุณ','ขอบคุณสำหรับความช่วยเหลือของคุณ'],['น้ำ','ฉันดื่มน้ำ'],['เพื่อน','เพื่อนของฉันอยู่ที่นี่'],['หนังสือ','ฉันอ่านหนังสือ'],['ประตู','กรุณาเปิดประตู'],['ถนน','ถนนสายนี้เงียบสงบ'],['พร้อม','ฉันพร้อมแล้ว'],['ความช่วยเหลือ','คุณช่วยฉันได้ไหม'],['ไปข้างหน้า','เราไปข้างหน้ากันเถอะ']
  ],
  uk: [
    ['привіт','Привіт, мій друже.'],['дякую','Дякую за твою допомогу.'],['вода',"Я п’ю воду."],['друг','Мій друг тут.'],['книга','Я читаю книгу.'],['двері','Відчини двері, будь ласка.'],['вулиця','Ця вулиця тиха.'],['готовий','Я готовий.'],['допомога','Можеш мені допомогти?'],['вперед','Рухаймося вперед.']
  ]
};
function starterLanguage(code) {
  if (/^zh-(?:Hant|TW|HK|MO)(?:-|$)/i.test(code)) return 'zh-Hant';
  return code.split('-')[0];
}
export function getStarterLesson(learningLanguage = 'es', primaryLanguage = 'en') {
  const learning = language(learningLanguage,'es','learning');
  const primary = language(primaryLanguage,'en','translation');
  const target = STARTERS[starterLanguage(learning)], base = STARTERS[starterLanguage(primary)];
  if (!target || !base) throw new Error('A starter is not available for that language pair. Paste your own words and translations instead.');
  return normalizeLesson({ learningLanguage:learning, primaryLanguage:primary,
    words:CONCEPTS.map((id,i) => ({
      id:`starter-${starterLanguage(learning)}-${starterLanguage(primary)}-${id}`,
      word:target[i][0], translation:base[i][0], sentence:target[i][1], sentenceTranslation:base[i][1]
    }))
  });
}
