/** Beginner vocabulary for Panda Lingo. All sentence pairs share the same meaning. */
export const LANGUAGES = Object.freeze([
  { code: 'en', label: 'English', native: 'English', locale: 'en-US' },
  { code: 'es', label: 'Spanish', native: 'Español', locale: 'es-ES' },
  { code: 'ja', label: 'Japanese', native: '日本語', locale: 'ja-JP' },
  { code: 'zh', label: 'Chinese', native: '中文', locale: 'zh-CN' },
  { code: 'fr', label: 'French', native: 'Français', locale: 'fr-FR' },
  { code: 'ko', label: 'Korean', native: '한국어', locale: 'ko-KR' },
  { code: 'de', label: 'German', native: 'Deutsch', locale: 'de-DE' }
]);

export const CATEGORIES = Object.freeze([
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'food', label: 'Food', icon: '🍓' },
  { id: 'everyday', label: 'Everyday', icon: '✨' }
]);

const CONCEPTS = [
  ['nature', 'water', '💧'], ['nature', 'tree', '🌳'],
  ['nature', 'flower', '🌸'], ['nature', 'sun', '☀️'],
  ['nature', 'moon', '🌙'], ['nature', 'mountain', '⛰️'],
  ['nature', 'river', '🏞️'], ['nature', 'bamboo', '🎋'],
  ['food', 'apple', '🍎'], ['food', 'banana', '🍌'],
  ['food', 'rice', '🍚'], ['food', 'tea', '🍵'],
  ['food', 'milk', '🥛'], ['food', 'bread', '🍞'],
  ['food', 'egg', '🥚'], ['food', 'fish', '🐟'],
  ['everyday', 'hello', '👋'], ['everyday', 'thanks', '🙏'],
  ['everyday', 'please', '🤲'], ['everyday', 'yes', '✅'],
  ['everyday', 'no', '🙅'], ['everyday', 'friend', '🧑‍🤝‍🧑'],
  ['everyday', 'home', '🏠'], ['everyday', 'book', '📖']
];

// Each row is [word, pronunciation hint, example sentence].
const TEXT = {
  en: [
    ['water', '', 'I drink water.'],
    ['tree', '', 'This tree is big.'],
    ['flower', '', 'The flower is beautiful.'],
    ['sun', '', 'The sun is shining.'],
    ['moon', '', 'I see the moon.'],
    ['mountain', '', 'The mountain is high.'],
    ['river', '', 'The river is long.'],
    ['bamboo', '', 'The panda eats bamboo.'],
    ['apple', '', 'I eat an apple.'],
    ['banana', '', 'The banana is yellow.'],
    ['rice', '', 'The rice is delicious.'],
    ['tea', '', 'I drink tea.'],
    ['milk', '', 'The milk is cold.'],
    ['bread', '', 'I like bread.'],
    ['egg', '', 'I eat an egg.'],
    ['fish', '', 'I eat fish.'],
    ['hello', '', 'Hello!'],
    ['thank you', '', 'Thank you for your help.'],
    ['please', '', 'Please give me water.'],
    ['yes', '', 'Yes, I understand.'],
    ['no', '', 'No, it is not a cat.'],
    ['friend', '', 'We are friends.'],
    ['home', '', 'I am going home.'],
    ['book', '', 'I read a book.']
  ],
  es: [
    ['agua', '', 'Bebo agua.'],
    ['árbol', '', 'Este árbol es grande.'],
    ['flor', '', 'La flor es bonita.'],
    ['sol', '', 'El sol brilla.'],
    ['luna', '', 'Veo la luna.'],
    ['montaña', '', 'La montaña es alta.'],
    ['río', '', 'El río es largo.'],
    ['bambú', '', 'El panda come bambú.'],
    ['manzana', '', 'Como una manzana.'],
    ['plátano', '', 'El plátano es amarillo.'],
    ['arroz', '', 'El arroz está delicioso.'],
    ['té', '', 'Bebo té.'],
    ['leche', '', 'La leche está fría.'],
    ['pan', '', 'Me gusta el pan.'],
    ['huevo', '', 'Como un huevo.'],
    ['pescado', '', 'Como pescado.'],
    ['hola', '', '¡Hola!'],
    ['gracias', '', 'Gracias por tu ayuda.'],
    ['por favor', '', 'Dame agua, por favor.'],
    ['sí', '', 'Sí, entiendo.'],
    ['no', '', 'No, no es un gato.'],
    ['amigo', '', 'Somos amigos.'],
    ['casa', '', 'Voy a casa.'],
    ['libro', '', 'Leo un libro.']
  ],
  ja: [
    ['水', 'mizu', '水を飲みます。'],
    ['木', 'ki', 'この木は大きいです。'],
    ['花', 'hana', '花はきれいです。'],
    ['太陽', 'taiyō', '太陽が輝いています。'],
    ['月', 'tsuki', '月が見えます。'],
    ['山', 'yama', '山は高いです。'],
    ['川', 'kawa', '川は長いです。'],
    ['竹', 'take', 'パンダは竹を食べます。'],
    ['りんご', 'ringo', 'りんごを食べます。'],
    ['バナナ', 'banana', 'バナナは黄色いです。'],
    ['ご飯', 'gohan', 'ご飯はおいしいです。'],
    ['お茶', 'ocha', 'お茶を飲みます。'],
    ['牛乳', 'gyūnyū', '牛乳は冷たいです。'],
    ['パン', 'pan', 'パンが好きです。'],
    ['卵', 'tamago', '卵を食べます。'],
    ['魚', 'sakana', '魚を食べます。'],
    ['こんにちは', 'konnichiwa', 'こんにちは！'],
    ['ありがとう', 'arigatō', '手伝ってくれてありがとう。'],
    ['ください', 'kudasai', '水をください。'],
    ['はい', 'hai', 'はい、わかります。'],
    ['いいえ', 'iie', 'いいえ、猫ではありません。'],
    ['友達', 'tomodachi', '私たちは友達です。'],
    ['家', 'ie', '家に帰ります。'],
    ['本', 'hon', '本を読みます。']
  ],
  zh: [
    ['水', 'shuǐ', '我喝水。'],
    ['树', 'shù', '这棵树很大。'],
    ['花', 'huā', '花很漂亮。'],
    ['太阳', 'tài yáng', '太阳在发光。'],
    ['月亮', 'yuè liang', '我看见月亮。'],
    ['山', 'shān', '山很高。'],
    ['河', 'hé', '这条河很长。'],
    ['竹子', 'zhú zi', '熊猫吃竹子。'],
    ['苹果', 'píng guǒ', '我吃一个苹果。'],
    ['香蕉', 'xiāng jiāo', '香蕉是黄色的。'],
    ['米饭', 'mǐ fàn', '米饭很好吃。'],
    ['茶', 'chá', '我喝茶。'],
    ['牛奶', 'niú nǎi', '牛奶是凉的。'],
    ['面包', 'miàn bāo', '我喜欢面包。'],
    ['鸡蛋', 'jī dàn', '我吃一个鸡蛋。'],
    ['鱼', 'yú', '我吃鱼。'],
    ['你好', 'nǐ hǎo', '你好！'],
    ['谢谢', 'xiè xie', '谢谢你的帮助。'],
    ['请', 'qǐng', '请给我水。'],
    ['是的', 'shì de', '是的，我明白了。'],
    ['不', 'bù', '不，这不是猫。'],
    ['朋友', 'péng you', '我们是朋友。'],
    ['家', 'jiā', '我回家。'],
    ['书', 'shū', '我看书。']
  ],
  fr: [
    ['eau', '', 'Je bois de l’eau.'],
    ['arbre', '', 'Cet arbre est grand.'],
    ['fleur', '', 'La fleur est belle.'],
    ['soleil', '', 'Le soleil brille.'],
    ['lune', '', 'Je vois la lune.'],
    ['montagne', '', 'La montagne est haute.'],
    ['rivière', '', 'La rivière est longue.'],
    ['bambou', '', 'Le panda mange du bambou.'],
    ['pomme', '', 'Je mange une pomme.'],
    ['banane', '', 'La banane est jaune.'],
    ['riz', '', 'Le riz est délicieux.'],
    ['thé', '', 'Je bois du thé.'],
    ['lait', '', 'Le lait est froid.'],
    ['pain', '', 'J’aime le pain.'],
    ['œuf', '', 'Je mange un œuf.'],
    ['poisson', '', 'Je mange du poisson.'],
    ['bonjour', '', 'Bonjour !'],
    ['merci', '', 'Merci pour ton aide.'],
    ['s’il te plaît', '', 'Donne-moi de l’eau, s’il te plaît.'],
    ['oui', '', 'Oui, je comprends.'],
    ['non', '', 'Non, ce n’est pas un chat.'],
    ['ami', '', 'Nous sommes amis.'],
    ['maison', '', 'Je rentre à la maison.'],
    ['livre', '', 'Je lis un livre.']
  ],
  ko: [
    ['물', 'mul', '물을 마셔요.'],
    ['나무', 'namu', '이 나무는 커요.'],
    ['꽃', 'kkot', '꽃이 예뻐요.'],
    ['태양', 'taeyang', '태양이 빛나요.'],
    ['달', 'dal', '달이 보여요.'],
    ['산', 'san', '산이 높아요.'],
    ['강', 'gang', '강이 길어요.'],
    ['대나무', 'daenamu', '판다는 대나무를 먹어요.'],
    ['사과', 'sagwa', '사과를 하나 먹어요.'],
    ['바나나', 'banana', '바나나는 노란색이에요.'],
    ['밥', 'bap', '밥이 맛있어요.'],
    ['차', 'cha', '차를 마셔요.'],
    ['우유', 'uyu', '우유가 차가워요.'],
    ['빵', 'ppang', '빵을 좋아해요.'],
    ['달걀', 'dalgyal', '달걀을 하나 먹어요.'],
    ['생선', 'saengseon', '생선을 먹어요.'],
    ['안녕하세요', 'annyeonghaseyo', '안녕하세요!'],
    ['고마워요', 'gomawoyo', '도와줘서 고마워요.'],
    ['주세요', 'juseyo', '물을 주세요.'],
    ['네', 'ne', '네, 알겠어요.'],
    ['아니요', 'aniyo', '아니요, 고양이가 아니에요.'],
    ['친구', 'chingu', '우리는 친구예요.'],
    ['집', 'jip', '집에 가요.'],
    ['책', 'chaek', '책을 읽어요.']
  ],
  de: [
    ['Wasser', '', 'Ich trinke Wasser.'],
    ['Baum', '', 'Dieser Baum ist groß.'],
    ['Blume', '', 'Die Blume ist schön.'],
    ['Sonne', '', 'Die Sonne scheint.'],
    ['Mond', '', 'Ich sehe den Mond.'],
    ['Berg', '', 'Der Berg ist hoch.'],
    ['Fluss', '', 'Der Fluss ist lang.'],
    ['Bambus', '', 'Der Panda frisst Bambus.'],
    ['Apfel', '', 'Ich esse einen Apfel.'],
    ['Banane', '', 'Die Banane ist gelb.'],
    ['Reis', '', 'Der Reis ist lecker.'],
    ['Tee', '', 'Ich trinke Tee.'],
    ['Milch', '', 'Die Milch ist kalt.'],
    ['Brot', '', 'Ich mag Brot.'],
    ['Ei', '', 'Ich esse ein Ei.'],
    ['Fisch', '', 'Ich esse Fisch.'],
    ['hallo', '', 'Hallo!'],
    ['danke', '', 'Danke für deine Hilfe.'],
    ['bitte', '', 'Gib mir bitte Wasser.'],
    ['ja', '', 'Ja, ich verstehe.'],
    ['nein', '', 'Nein, das ist keine Katze.'],
    ['Freund', '', 'Wir sind Freunde.'],
    ['Zuhause', '', 'Ich gehe nach Hause.'],
    ['Buch', '', 'Ich lese ein Buch.']
  ]
};

const LANGUAGE_ALIASES = {
  english: 'en', spanish: 'es', japanese: 'ja', chinese: 'zh', mandarin: 'zh',
  french: 'fr', korean: 'ko', german: 'de', español: 'es', français: 'fr',
  deutsch: 'de', '日本語': 'ja', '中文': 'zh', '한국어': 'ko'
};

function normalizeLanguage(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const language = value.trim().replace(/_/g, '-');
  const lower = language.toLowerCase();
  if (LANGUAGE_ALIASES[lower]) return LANGUAGE_ALIASES[lower];
  const base = lower.split('-')[0];
  if (Object.hasOwn(TEXT, base)) return base;
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language) ? language : fallback;
}

/** Return fresh entries so that game progress never mutates the built-in decks. */
export function getDeck(target = 'es', base = 'en', category = 'nature') {
  const targetCode = normalizeLanguage(target, 'es');
  const baseCode = normalizeLanguage(base, 'en');
  const targetRows = TEXT[targetCode] || TEXT.es;
  const baseRows = TEXT[baseCode] || TEXT.en;
  const selectedCategory = CATEGORIES.some(item => item.id === category) ? category : null;
  return CONCEPTS.flatMap(([group, key, emoji], index) => {
    if (selectedCategory && group !== selectedCategory) return [];
    const [word, reading, sentence] = targetRows[index];
    const [translation, , sentenceTranslation] = baseRows[index];
    return [{ id: `${group}-${key}`, word, translation, reading, emoji, sentence, sentenceTranslation }];
  });
}

const MAX_ENTRIES = 5000;
const MAX_INPUT_LENGTH = 12 * 1024 * 1024;
const MAX_URL_LENGTH = 4 * 1024 * 1024;

function cleanText(value, maxLength, field) {
  if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) return '';
  let text = String(value);
  if (text.length > maxLength) throw new Error(`A ${field} is too long. Please keep it under ${maxLength} characters.`);
  // Treat every imported item as text. Remove active/hidden markup and control characters.
  text = text.replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ').trim();
  return text;
}

function decodeBase64(text) {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || typeof atob !== 'function') return null;
  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { return null; }
}

function parseSerialized(value) {
  if (value.length > MAX_INPUT_LENGTH) throw new Error('That vocabulary file is too large. Please import a smaller deck.');
  let text = value.replace(/^\uFEFF/, '').trim();
  for (let pass = 0; pass < 4; pass++) {
    try { return JSON.parse(text); } catch { /* Try an encoded GoLingo payload. */ }
    if (/%[0-9A-Fa-f]{2}/.test(text)) {
      try {
        const decoded = decodeURIComponent(text);
        if (decoded !== text) { text = decoded; continue; }
      } catch { /* Fall through to base64. */ }
    }
    const decoded = decodeBase64(text);
    if (decoded && decoded !== text) { text = decoded; continue; }
    break;
  }
  throw new Error('Please use valid JSON with a words list containing word and translation.');
}

/**
 * Normalize a GoLingo deck, a JSON string, or a root array of vocabulary objects.
 * No HTML is kept; no code is evaluated; no external content is requested.
 */
export function parseVocabulary(input) {
  let source = input;
  let primaryLanguage = 'en';
  let learningLanguage = 'es';
  let rows = null;
  for (let depth = 0; depth < 8; depth++) {
    if (typeof source === 'string') source = parseSerialized(source);
    if (Array.isArray(source)) { rows = source; break; }
    if (!source || typeof source !== 'object') break;
    primaryLanguage = normalizeLanguage(source.primaryLanguage ?? source.sourceLanguage ?? source.baseLanguage, primaryLanguage);
    learningLanguage = normalizeLanguage(source.learningLanguage ?? source.targetLanguage ?? source.language, learningLanguage);
    if (Array.isArray(source.words)) { rows = source.words; break; }
    if (Array.isArray(source.items)) { rows = source.items; break; }
    if (source.data != null) { source = source.data; continue; }
    if (source.payload != null) { source = source.payload; continue; }
    if (source.vocabulary != null) { source = source.vocabulary; continue; }
    if (typeof source.words === 'string') { source = source.words; continue; }
    break;
  }
  if (!rows || !rows.length) throw new Error('This deck has no words yet. Add at least one word and its translation.');
  if (rows.length > MAX_ENTRIES) throw new Error(`Please import ${MAX_ENTRIES.toLocaleString('en-US')} words or fewer at a time.`);
  const usedIds = new Set();
  const words = [];
  for (let index = 0; index < rows.length; index++) {
    const entry = rows[index];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const word = cleanText(entry.word ?? entry.term ?? entry.text, 400, 'word');
    const translation = cleanText(entry.translation ?? entry.meaning ?? entry.definition, 400, 'translation');
    if (!word || !translation) continue;
    let id = cleanText(entry.id ?? `custom-${index + 1}`, 120, 'word ID') || `custom-${index + 1}`;
    const originalId = id;
    let suffix = 2;
    while (usedIds.has(id)) id = `${originalId}-${suffix++}`;
    usedIds.add(id);
    words.push({
      id, word, translation,
      reading: cleanText(entry.reading ?? entry.romanization ?? entry.pronunciation, 500, 'pronunciation hint'),
      emoji: cleanText(entry.emoji, 32, 'emoji') || '🎋',
      sentence: cleanText(entry.sentence ?? entry.example, 2000, 'sentence'),
      sentenceTranslation: cleanText(entry.sentenceTranslation ?? entry.exampleTranslation, 2000, 'sentence translation')
    });
  }
  if (!words.length) throw new Error('No usable words were found. Each word needs a word and a translation.');
  return { primaryLanguage, learningLanguage, words };
}

/** Read incoming vocabulary from a GoLingo URL; null means no payload was supplied. */
export function loadIncomingVocabulary(locationLike = globalThis.location) {
  if (!locationLike) return null;
  let location = locationLike;
  if (typeof locationLike === 'string' || locationLike instanceof URL) {
    try { location = new URL(String(locationLike), 'https://panda-lingo.invalid/'); }
    catch { throw new Error('The vocabulary link is not valid.'); }
  }
  const search = String(location.search || '');
  const hash = String(location.hash || '').replace(/^#/, '');
  if (search.length + hash.length > MAX_URL_LENGTH) throw new Error('This vocabulary link is too large. Use Import words to load the JSON file instead.');
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^\?/, ''));
  const fields = ['data', 'words', 'payload', 'vocabulary', 'golingoData', 'json'];
  let payload = null;
  for (const params of [query, fragment]) {
    for (const field of fields) {
      if (params.has(field)) { payload = params.get(field); break; }
    }
    if (payload !== null) break;
  }
  if (payload === null && /^(?:\{|\[|%7[Bb]|%5[Bb])/.test(hash)) payload = hash;
  if (payload === null) return null;
  if (!payload.trim()) throw new Error('The vocabulary link is empty. Please send a deck from GoLingo again.');
  return parseVocabulary({
    primaryLanguage: query.get('primaryLanguage') || fragment.get('primaryLanguage') || query.get('baseLanguage') || 'en',
    learningLanguage: query.get('learningLanguage') || fragment.get('learningLanguage') || query.get('targetLanguage') || 'es',
    data: payload
  });
}
