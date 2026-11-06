/** GoLingo Koi Garden — dependency-free vocabulary, safe imports and device speech. */
export const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English', nativeName: 'English', voice: 'en-US' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', voice: 'ja-JP' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', voice: 'zh-CN' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', voice: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', voice: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', voice: 'de-DE' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', voice: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', voice: 'pt-BR' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', voice: 'ko-KR' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', voice: 'vi-VN' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', voice: 'th-TH' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', voice: 'ar-SA' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', voice: 'hi-IN' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', voice: 'ru-RU' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', voice: 'uk-UA' },
]);

const CONCEPTS = ['water', 'fish', 'flower', 'sun', 'moon', 'tree', 'bird', 'rain', 'wind', 'leaf', 'rock', 'pond'];
const VOCABULARY = {
  en: {
    words: ['water', 'fish', 'flower', 'sun', 'moon', 'tree', 'bird', 'rain', 'wind', 'leaf', 'rock', 'pond'],
    sentences: ['The water is clear.', 'The fish swims in the pond.', 'The flower is beautiful.', 'The sun is warm.', 'The moon shines at night.', 'The tree is tall.', 'The bird sings.', 'The rain falls softly.', 'The wind is gentle.', 'The leaf is green.', 'The rock is near the water.', 'The pond is calm.'],
  },
  ja: {
    words: ['水', '魚', '花', '太陽', '月', '木', '鳥', '雨', '風', '葉', '岩', '池'],
    romanizations: ['mizu', 'sakana', 'hana', 'taiyō', 'tsuki', 'ki', 'tori', 'ame', 'kaze', 'ha', 'iwa', 'ike'],
    sentences: ['水は澄んでいます。', '魚が池で泳いでいます。', '花は美しいです。', '太陽は暖かいです。', '月は夜に輝きます。', '木は高いです。', '鳥が鳴いています。', '雨が静かに降っています。', '風は穏やかです。', '葉は緑色です。', '岩は水の近くにあります。', '池は穏やかです。'],
  },
  zh: {
    words: ['水', '鱼', '花', '太阳', '月亮', '树', '鸟', '雨', '风', '叶子', '岩石', '池塘'],
    romanizations: ['shuǐ', 'yú', 'huā', 'tài yáng', 'yuè liang', 'shù', 'niǎo', 'yǔ', 'fēng', 'yè zi', 'yán shí', 'chí táng'],
    sentences: ['水很清澈。', '鱼在池塘里游泳。', '花很美。', '太阳很温暖。', '月亮在夜晚发光。', '树很高。', '鸟在唱歌。', '雨轻轻地落下。', '风很轻柔。', '叶子是绿色的。', '岩石在水边。', '池塘很平静。'],
  },
  es: {
    words: ['agua', 'pez', 'flor', 'sol', 'luna', 'árbol', 'pájaro', 'lluvia', 'viento', 'hoja', 'roca', 'estanque'],
    sentences: ['El agua es clara.', 'El pez nada en el estanque.', 'La flor es hermosa.', 'El sol es cálido.', 'La luna brilla por la noche.', 'El árbol es alto.', 'El pájaro canta.', 'La lluvia cae suavemente.', 'El viento es suave.', 'La hoja es verde.', 'La roca está cerca del agua.', 'El estanque está tranquilo.'],
  },
  fr: {
    words: ['eau', 'poisson', 'fleur', 'soleil', 'lune', 'arbre', 'oiseau', 'pluie', 'vent', 'feuille', 'rocher', 'étang'],
    sentences: ["L’eau est claire.", 'Le poisson nage dans l’étang.', 'La fleur est belle.', 'Le soleil est chaud.', 'La lune brille la nuit.', 'L’arbre est grand.', 'L’oiseau chante.', 'La pluie tombe doucement.', 'Le vent est doux.', 'La feuille est verte.', 'Le rocher est près de l’eau.', 'L’étang est calme.'],
  },
  de: {
    words: ['Wasser', 'Fisch', 'Blume', 'Sonne', 'Mond', 'Baum', 'Vogel', 'Regen', 'Wind', 'Blatt', 'Felsen', 'Teich'],
    sentences: ['Das Wasser ist klar.', 'Der Fisch schwimmt im Teich.', 'Die Blume ist schön.', 'Die Sonne ist warm.', 'Der Mond scheint nachts.', 'Der Baum ist hoch.', 'Der Vogel singt.', 'Der Regen fällt sanft.', 'Der Wind ist sanft.', 'Das Blatt ist grün.', 'Der Felsen ist in der Nähe des Wassers.', 'Der Teich ist ruhig.'],
  },
  it: {
    words: ['acqua', 'pesce', 'fiore', 'sole', 'luna', 'albero', 'uccello', 'pioggia', 'vento', 'foglia', 'roccia', 'stagno'],
    sentences: ['L’acqua è limpida.', 'Il pesce nuota nello stagno.', 'Il fiore è bello.', 'Il sole è caldo.', 'La luna splende di notte.', 'L’albero è alto.', 'L’uccello canta.', 'La pioggia cade dolcemente.', 'Il vento è leggero.', 'La foglia è verde.', 'La roccia è vicino all’acqua.', 'Lo stagno è calmo.'],
  },
  pt: {
    words: ['água', 'peixe', 'flor', 'sol', 'lua', 'árvore', 'pássaro', 'chuva', 'vento', 'folha', 'rocha', 'lagoa'],
    sentences: ['A água é clara.', 'O peixe nada na lagoa.', 'A flor é bonita.', 'O sol é quente.', 'A lua brilha à noite.', 'A árvore é alta.', 'O pássaro canta.', 'A chuva cai suavemente.', 'O vento é suave.', 'A folha é verde.', 'A rocha fica perto da água.', 'A lagoa está calma.'],
  },
  ko: {
    words: ['물', '물고기', '꽃', '태양', '달', '나무', '새', '비', '바람', '잎', '바위', '연못'],
    romanizations: ['mul', 'mulgogi', 'kkot', 'taeyang', 'dal', 'namu', 'sae', 'bi', 'baram', 'ip', 'bawi', 'yeonmot'],
    sentences: ['물이 맑아요.', '물고기가 연못에서 헤엄쳐요.', '꽃이 아름다워요.', '태양이 따뜻해요.', '달이 밤에 빛나요.', '나무가 높아요.', '새가 노래해요.', '비가 부드럽게 내려요.', '바람이 부드러워요.', '잎이 초록색이에요.', '바위가 물 가까이에 있어요.', '연못이 잔잔해요.'],
  },
  vi: {
    words: ['nước', 'cá', 'hoa', 'mặt trời', 'mặt trăng', 'cây', 'chim', 'mưa', 'gió', 'lá', 'tảng đá', 'ao'],
    sentences: ['Nước trong.', 'Cá bơi trong ao.', 'Hoa đẹp.', 'Mặt trời ấm áp.', 'Mặt trăng tỏa sáng vào ban đêm.', 'Cây cao.', 'Chim hót.', 'Mưa rơi nhẹ nhàng.', 'Gió nhẹ.', 'Lá có màu xanh.', 'Tảng đá ở gần nước.', 'Ao yên ả.'],
  },
  th: {
    words: ['น้ำ', 'ปลา', 'ดอกไม้', 'ดวงอาทิตย์', 'ดวงจันทร์', 'ต้นไม้', 'นก', 'ฝน', 'ลม', 'ใบไม้', 'ก้อนหิน', 'สระน้ำ'],
    sentences: ['น้ำใส', 'ปลาว่ายน้ำในสระ', 'ดอกไม้สวย', 'ดวงอาทิตย์อบอุ่น', 'ดวงจันทร์ส่องแสงในเวลากลางคืน', 'ต้นไม้สูง', 'นกร้องเพลง', 'ฝนตกเบา ๆ', 'ลมพัดเบา ๆ', 'ใบไม้มีสีเขียว', 'ก้อนหินอยู่ใกล้น้ำ', 'สระน้ำนิ่งสงบ'],
  },
  ar: {
    words: ['ماء', 'سمكة', 'زهرة', 'شمس', 'قمر', 'شجرة', 'طائر', 'مطر', 'ريح', 'ورقة شجر', 'صخرة', 'بركة'],
    sentences: ['الماء صافٍ.', 'تسبح السمكة في البركة.', 'الزهرة جميلة.', 'الشمس دافئة.', 'يضيء القمر في الليل.', 'الشجرة طويلة.', 'الطائر يغرد.', 'يهطل المطر برفق.', 'الريح لطيفة.', 'ورقة الشجر خضراء.', 'الصخرة قرب الماء.', 'البركة هادئة.'],
  },
  hi: {
    words: ['पानी', 'मछली', 'फूल', 'सूरज', 'चाँद', 'पेड़', 'पक्षी', 'बारिश', 'हवा', 'पत्ता', 'चट्टान', 'तालाब'],
    sentences: ['पानी साफ़ है।', 'मछली तालाब में तैरती है।', 'फूल सुंदर है।', 'सूरज गर्म है।', 'चाँद रात में चमकता है।', 'पेड़ ऊँचा है।', 'पक्षी गाता है।', 'बारिश धीरे-धीरे गिरती है।', 'हवा हल्की है।', 'पत्ता हरा है।', 'चट्टान पानी के पास है।', 'तालाब शांत है।'],
  },
  ru: {
    words: ['вода', 'рыба', 'цветок', 'солнце', 'луна', 'дерево', 'птица', 'дождь', 'ветер', 'лист', 'скала', 'пруд'],
    sentences: ['Вода прозрачная.', 'Рыба плавает в пруду.', 'Цветок красивый.', 'Солнце тёплое.', 'Луна светит ночью.', 'Дерево высокое.', 'Птица поёт.', 'Дождь тихо идёт.', 'Дует лёгкий ветер.', 'Лист зелёный.', 'Скала находится у воды.', 'Пруд спокойный.'],
  },
  uk: {
    words: ['вода', 'риба', 'квітка', 'сонце', 'місяць', 'дерево', 'птах', 'дощ', 'вітер', 'листок', 'скеля', 'ставок'],
    sentences: ['Вода прозора.', 'Риба плаває у ставку.', 'Квітка гарна.', 'Сонце тепле.', 'Місяць світить уночі.', 'Дерево високе.', 'Птах співає.', 'Дощ тихо падає.', 'Вітер лагідний.', 'Листок зелений.', 'Скеля біля води.', 'Ставок спокійний.'],
  },
};

const cleanCode = (value, fallback = 'en') => {
  const candidate = String(value || fallback).trim().replace(/_/g, '-');
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(candidate) ? candidate : fallback;
};
const baseCode = code => cleanCode(code).split('-')[0].toLowerCase();
const text = (value, limit = 500) => typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, limit) : '';
const audioURL = value => {
  const url = text(value, 2048);
  if (!url || /[\u0000-\u001F\s\\]/.test(url)) return undefined;
  if (/^https?:\/\//i.test(url)) {
    try { const parsed = new URL(url); return parsed.username || parsed.password ? undefined : parsed.href; } catch { return undefined; }
  }
  // Local audio paths are allowed; schemes and protocol-relative URLs are not.
  if (!url.startsWith('//') && !/^[^/?#]*:/.test(url)) return url;
  return undefined;
};

export function makeDefaultDeck(learningLanguage = 'ja', primaryLanguage = 'en') {
  const learn = baseCode(learningLanguage), primary = baseCode(primaryLanguage);
  const target = VOCABULARY[learn] || VOCABULARY.ja;
  const translation = VOCABULARY[primary] || VOCABULARY.en;
  return {
    primaryLanguage: VOCABULARY[primary] ? primary : 'en',
    learningLanguage: VOCABULARY[learn] ? learn : 'ja',
    words: CONCEPTS.map((id, i) => ({
      id,
      word: target.words[i],
      translation: translation.words[i],
      romanization: target.romanizations?.[i] || '',
      sentence: target.sentences[i],
      sentenceTranslation: translation.sentences[i],
    })),
  };
}

function parseRows(value) {
  const rows = value.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  if (rows.length > 2000) throw new Error('Please import no more than 2,000 words or sentences at a time.');
  return rows.map((row, i) => {
    const fields = row.split(row.includes('|') ? '|' : '\t').map(part => part.trim());
    return { id: `import-${i + 1}`, word: fields[0], translation: fields[1] || '', sentence: fields[2] || '', sentenceTranslation: fields[3] || '' };
  });
}

/** Accepts the GoLingo JSON schema, arrays, wrapper payloads, and one word | translation per line. */
export function normalizePayload(input, fallback = {}) {
  let value = input;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof value === 'string') {
      if (value.length > 2_000_000) throw new Error('This word list is too large. Please use a file smaller than 2 MB.');
      const raw = value.trim();
      if (!raw) throw new Error('Add at least one word or sentence first.');
      if (/^[\[{]/.test(raw)) {
        try { value = JSON.parse(raw); } catch { throw new Error('The JSON could not be read. Check its brackets, commas and quotation marks.'); }
      } else { value = { words: parseRows(raw) }; }
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && !['words','sentences','items','phrases','entries'].some(key => Array.isArray(value[key]))) {
      if (value.payload !== undefined || value.data !== undefined) {
        const wrapper = value;
        const inner = wrapper.payload ?? wrapper.data;
        if (inner === value) throw new Error('This word list contains a circular payload.');
        // Preserve language metadata provided alongside a wrapped data object.
        fallback = {
          ...fallback,
          primaryLanguage: wrapper.primaryLanguage || wrapper.translationLanguage || fallback.primaryLanguage,
          learningLanguage: wrapper.learningLanguage || wrapper.targetLanguage || fallback.learningLanguage,
        };
        value = inner;
        continue;
      }
    }
    break;
  }
  if (!value || typeof value !== 'object') throw new Error('Use a GoLingo JSON word list or one word | translation per line.');
  const source = Array.isArray(value) ? { words: value } : value;
  const primaryLanguage = cleanCode(source.primaryLanguage || source.translationLanguage || source.nativeLanguage || source.sourceLanguage || fallback.primaryLanguage, 'en');
  const learningLanguage = cleanCode(source.learningLanguage || source.targetLanguage || source.language || fallback.learningLanguage, 'ja');
  const primaryEntries = [source.words, source.items, source.phrases, source.entries].find(Array.isArray) || [];
  const requestedCount = primaryEntries.length + (Array.isArray(source.sentences) ? source.sentences.length : 0);
  if (requestedCount > 2000) throw new Error('Please import no more than 2,000 words or sentences at a time.');
  const entries = [];
  entries.push(...primaryEntries.map(item => ({ item, kind: primaryEntries === source.phrases ? 'sentence' : 'word' })));
  if (Array.isArray(source.sentences)) entries.push(...source.sentences.map(item => ({ item, kind: 'sentence' })));
  if (entries.length > 2000) throw new Error('Please import no more than 2,000 words or sentences at a time.');
  if (!entries.length) throw new Error('No words or sentences were found. Use a words or sentences array.');
  const ids = new Set();
  const words = entries.map(({ item, kind }, index) => {
    const row = typeof item === 'string' ? { word: item } : item;
    if (!row || typeof row !== 'object') return null;
    const isSentence = kind === 'sentence' || (!row.word && !row.text && !row.term && !!row.sentence);
    const word = text(row.word || row.text || row.term || row.phrase || row.sentence, 500);
    if (!word) return null;
    let id = text(row.id, 120) || `import-${index + 1}`;
    let suffix = 1;
    while (ids.has(id)) id = `${text(row.id, 100) || 'import'}-${index + 1}-${suffix++}`;
    ids.add(id);
    const sentence = text(row.sentence || (isSentence ? word : ''), 1500);
    const translation = text(row.translation || row.meaning || (isSentence ? row.sentenceTranslation : ''), 1000);
    return {
      id, word, translation,
      romanization: text(row.romanization || row.pinyin || row.romaji || row.transliteration, 500),
      sentence,
      sentenceTranslation: text(row.sentenceTranslation || row.sentence_translation || (isSentence ? translation : ''), 1500),
      ...(isSentence ? { kind: 'sentence' } : {}),
      ...(audioURL(row.audioUrl || row.audioURL || row.audio || row.wordAudioUrl || (isSentence ? row.sentenceAudioUrl : '')) ? { audioUrl: audioURL(row.audioUrl || row.audioURL || row.audio || row.wordAudioUrl || (isSentence ? row.sentenceAudioUrl : '')) } : {}),
      ...(audioURL(row.sentenceAudioUrl || row.sentenceAudioURL || row.sentenceAudio) ? { sentenceAudioUrl: audioURL(row.sentenceAudioUrl || row.sentenceAudioURL || row.sentenceAudio) } : {}),
    };
  }).filter(Boolean);
  if (!words.length) throw new Error('The list has no readable words. Each entry needs a word, text or sentence field.');
  return { primaryLanguage, learningLanguage, words };
}

export function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function deckKey(deck) {
  const input = JSON.stringify([deck.primaryLanguage, deck.learningLanguage, deck.words.map(item => [item.id, item.word, item.translation])]);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `koi-${(hash >>> 0).toString(36)}`;
}

/** One speech/audio channel. Call unlock() from Start or another user gesture. */
export class Speaker {
  constructor({ onStatus = () => {}, onActivity = () => {} } = {}) {
    this.onStatus = onStatus;
    this.onActivity = onActivity;
    this._activity = false;
    this.enabled = true;
    this.repeat = false;
    this.rate = 0.82;
    this.synth = globalThis.speechSynthesis || null;
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    if (this.audio) { this.audio.preload = 'auto'; this.audio.setAttribute('playsinline', ''); }
    this._token = 0;
    this._timer = null;
    this._job = null;
    this._utterance = null;
    this._ended = false;
    this._unlocked = false;
  }
  _setActivity(active, token = this._token) {
    if (token !== this._token || this._activity === active) return;
    this._activity = active;
    this.onActivity(active);
  }
  unlock() {
    this.synth?.resume?.();
    if (!this._unlocked && this.synth && typeof SpeechSynthesisUtterance !== 'undefined') {
      // A silent utterance primes iOS speech during the initiating tap.
      const warmup = new SpeechSynthesisUtterance('');
      warmup.volume = 0;
      this.synth.speak(warmup);
    }
    this._unlocked = true;
  }
  speak(item, lang = 'en', { sentence = false, repeat = this.repeat } = {}) {
    this.stop();
    if (!this.enabled) return;
    const entry = typeof item === 'string' ? { word: item } : (item || {});
    const spoken = text(sentence ? entry.sentence : entry.word, 1500);
    if (!spoken) return;
    this._job = {
      text: spoken,
      lang: cleanCode(lang, 'en'),
      audioUrl: audioURL(sentence ? entry.sentenceAudioUrl : entry.audioUrl),
      sentence,
      repeat: !sentence && !!repeat,
    };
    this._ended = false;
    this.onStatus('');
    this._cycle(this._token);
  }
  _cycle(token) {
    this._timer = null;
    if (token !== this._token || !this._job || !this.enabled) return;
    this._ended = false;
    const job = this._job;
    if (job.audioUrl && this.audio) {
      const player = this.audio;
      let resolved = false;
      const fallback = () => {
        if (resolved || token !== this._token) return;
        resolved = true;
        player.onplaying = player.onended = player.onerror = null;
        player.pause();
        this._setActivity(false, token);
        job.audioUrl = undefined; // Try a failing remote clip only once per selected item.
        this._tts(token);
      };
      player.onplaying = () => {
        if (!resolved && token === this._token) this._setActivity(true, token);
      };
      player.onended = () => {
        if (resolved || token !== this._token) return;
        resolved = true;
        player.onplaying = player.onended = player.onerror = null;
        this._finish(token);
      };
      player.onerror = fallback;
      player.src = job.audioUrl;
      player.playbackRate = Math.max(0.75, this.rate);
      try { const promise = player.play(); if (promise?.catch) promise.catch(fallback); } catch { fallback(); }
    } else this._tts(token);
  }
  _tts(token) {
    if (token !== this._token || !this._job || !this.enabled) return;
    if (!this.synth || typeof SpeechSynthesisUtterance === 'undefined') {
      this._setActivity(false, token);
      this.onStatus('Pronunciation is unavailable in this browser. You can still learn with the word and translation.');
      this._ended = true;
      return;
    }
    const job = this._job;
    const configured = LANGUAGES.find(item => item.code === baseCode(job.lang));
    const requested = job.lang.includes('-') ? job.lang : configured?.voice || job.lang;
    const voices = this.synth.getVoices();
    const exact = voices.filter(voice => voice.lang.toLowerCase() === requested.toLowerCase());
    const matching = exact.length ? exact : voices.filter(voice => baseCode(voice.lang) === baseCode(job.lang));
    // Do not knowingly read foreign text using an unrelated installed language.
    if (voices.length && !matching.length) {
      this._setActivity(false, token);
      this.onStatus(`A ${configured?.name || job.lang} voice is not installed on this device. Try supplied audio or another language.`);
      this._ended = true;
      return;
    }
    const utterance = new SpeechSynthesisUtterance(job.text);
    utterance.lang = requested;
    utterance.rate = this.rate;
    utterance.pitch = 1;
    utterance.volume = 1;
    if (matching.length) utterance.voice = matching.find(voice => voice.localService) || matching[0];
    utterance.onstart = () => { if (token === this._token) this._setActivity(true, token); };
    utterance.onend = () => { if (token === this._token) this._finish(token); };
    utterance.onerror = event => {
      if (token !== this._token) return;
      this._setActivity(false, token);
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      this._ended = true;
      this.onStatus('Tap the speaker to try pronunciation again. This device may need a voice for the selected language.');
    };
    this._utterance = utterance;
    try { this.synth.resume(); this.synth.speak(utterance); } catch {
      this._setActivity(false, token);
      this._ended = true;
      this.onStatus('Tap the speaker to enable pronunciation on this device.');
    }
  }
  _finish(token) {
    if (token !== this._token) return;
    this._setActivity(false, token);
    this._ended = true;
    this._utterance = null;
    if (this._job?.repeat && !this._job.sentence && this.enabled) {
      this._timer = setTimeout(() => this._cycle(token), 1400);
    }
  }
  stop() {
    this._token++;
    this._setActivity(false);
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
    this._job = null;
    this._ended = false;
    if (this.audio) {
      this.audio.onplaying = this.audio.onended = this.audio.onerror = null;
      this.audio.pause();
      try { this.audio.currentTime = 0; } catch { /* media may not be loaded yet */ }
    }
    if (this._utterance) { this._utterance.onstart = this._utterance.onend = this._utterance.onerror = null; }
    this._utterance = null;
    this.synth?.cancel?.();
  }
  setEnabled(enabled) { this.enabled = !!enabled; if (!this.enabled) this.stop(); }
  setRepeat(repeat) {
    this.repeat = !!repeat;
    if (this._job) this._job.repeat = this.repeat && !this._job.sentence;
    if (!this.repeat && this._timer !== null) { clearTimeout(this._timer); this._timer = null; }
    else if (this.repeat && this._job && !this._job.sentence && this._ended && this._timer === null) {
      this._timer = setTimeout(() => { this._timer = null; this._cycle(this._token); }, 1400);
    }
  }
  setRate(rate) { this.rate = Math.min(1.3, Math.max(0.5, Number(rate) || 0.82)); }
  destroy() { this.stop(); if (this.audio) { this.audio.removeAttribute('src'); this.audio.load(); } }
}

/** Optional quiet procedural water and pentatonic chimes; no remote media. */
export class Ambience {
  constructor() { this.enabled = false; this.context = null; this.master = null; this.noise = null; }
  unlock() {
    if (!this.context) {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      try {
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.context.destination);
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
        const samples = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < samples.length; i++) { last = (last + (Math.random() * 2 - 1) * 0.025) / 1.025; samples[i] = last * 4; }
        this.noise = this.context.createBufferSource();
        this.noise.buffer = buffer;
        this.noise.loop = true;
        const filter = this.context.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 700;
        const gain = this.context.createGain(); gain.gain.value = 0.18;
        this.noise.connect(filter); filter.connect(gain); gain.connect(this.master);
        this.noise.start();
      } catch { return false; }
    }
    this.context.resume().catch(() => {});
    return true;
  }
  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (this.enabled) this.unlock();
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.enabled ? 0.13 : 0, this.context.currentTime, 0.3);
    }
  }
  ping(step = 0) {
    if (!this.enabled || !this.context || !this.master) return;
    const pentatonic = [0, 2, 4, 7, 9];
    const note = 440 * 2 ** (pentatonic[Math.abs(Math.round(step)) % 5] / 12);
    const now = this.context.currentTime;
    for (let i = 0; i < 2; i++) {
      const oscillator = this.context.createOscillator();
      oscillator.type = 'sine'; oscillator.frequency.value = note * (i ? 2 : 1);
      const gain = this.context.createGain(); gain.gain.value = 0;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(i ? 0.05 : 0.14, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      oscillator.connect(gain); gain.connect(this.master);
      oscillator.start(now); oscillator.stop(now + 2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    }
  }
  destroy() { try { this.noise?.stop(); this.context?.close(); } catch { /* already closed */ } }
}
