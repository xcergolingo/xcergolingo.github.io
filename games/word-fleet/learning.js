(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FleetLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_ENTRIES = 1000;
  var MAX_INPUT = 1048576;
  var languages = [
    { code: 'en', label: 'English', nativeName: 'English' },
    { code: 'es', label: 'Spanish', nativeName: 'Español', builtIn: true },
    { code: 'ja', label: 'Japanese', nativeName: '日本語', builtIn: true },
    { code: 'fr', label: 'French', nativeName: 'Français', builtIn: true },
    { code: 'zh', label: 'Chinese', nativeName: '中文', builtIn: true },
    { code: 'de', label: 'German', nativeName: 'Deutsch', builtIn: true },
    { code: 'ko', label: 'Korean', nativeName: '한국어', builtIn: true },
    { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
    { code: 'it', label: 'Italian', nativeName: 'Italiano' },
    { code: 'vi', label: 'Vietnamese', nativeName: 'Tiếng Việt' },
    { code: 'ar', label: 'Arabic', nativeName: 'العربية' },
    { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'ru', label: 'Russian', nativeName: 'Русский' },
    { code: 'th', label: 'Thai', nativeName: 'ไทย' },
    { code: 'uk', label: 'Ukrainian', nativeName: 'Українська' },
    { code: 'nl', label: 'Dutch', nativeName: 'Nederlands' },
    { code: 'sv', label: 'Swedish', nativeName: 'Svenska' },
    { code: 'da', label: 'Danish', nativeName: 'Dansk' },
    { code: 'no', label: 'Norwegian', nativeName: 'Norsk' },
    { code: 'fi', label: 'Finnish', nativeName: 'Suomi' },
    { code: 'pl', label: 'Polish', nativeName: 'Polski' },
    { code: 'cs', label: 'Czech', nativeName: 'Čeština' },
    { code: 'el', label: 'Greek', nativeName: 'Ελληνικά' },
    { code: 'tr', label: 'Turkish', nativeName: 'Türkçe' },
    { code: 'he', label: 'Hebrew', nativeName: 'עברית' },
    { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia' },
    { code: 'ms', label: 'Malay', nativeName: 'Bahasa Melayu' },
    { code: 'fil', label: 'Filipino', nativeName: 'Filipino' },
    { code: 'ro', label: 'Romanian', nativeName: 'Română' },
    { code: 'hu', label: 'Hungarian', nativeName: 'Magyar' },
    { code: 'bn', label: 'Bengali', nativeName: 'বাংলা' },
    { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்' }
  ];

  // Handwritten starter content. Other languages are available through custom imports.
  var rows = {
    es: [
      ['barco', 'ship', 'El barco está en el puerto.', 'The ship is in the harbor.'],
      ['mar', 'sea', 'El mar está tranquilo.', 'The sea is calm.'],
      ['agua', 'water', 'Quiero un vaso de agua.', 'I want a glass of water.'],
      ['isla', 'island', 'La isla es pequeña.', 'The island is small.'],
      ['puerto', 'harbor', 'Vamos al puerto.', 'We are going to the harbor.'],
      ['viento', 'wind', 'El viento es fuerte.', 'The wind is strong.'],
      ['sol', 'sun', 'El sol brilla.', 'The sun is shining.'],
      ['luna', 'moon', 'La luna está en el cielo.', 'The moon is in the sky.'],
      ['estrella', 'star', 'Veo una estrella.', 'I see a star.'],
      ['pez', 'fish', 'El pez nada en el agua.', 'The fish swims in the water.'],
      ['playa', 'beach', 'Caminamos por la playa.', 'We walk along the beach.'],
      ['mapa', 'map', 'Necesito un mapa.', 'I need a map.'],
      ['brújula', 'compass', 'La brújula señala el norte.', 'The compass points north.'],
      ['puente', 'bridge', 'Cruzamos el puente.', 'We cross the bridge.'],
      ['billete', 'ticket', 'Tengo un billete de tren.', 'I have a train ticket.'],
      ['tren', 'train', 'El tren llega pronto.', 'The train arrives soon.'],
      ['casa', 'house', 'Mi casa está cerca.', 'My house is nearby.'],
      ['amigo', 'friend', 'Mi amigo habla español.', 'My friend speaks Spanish.'],
      ['comida', 'food', 'La comida está deliciosa.', 'The food is delicious.'],
      ['hola', 'hello', 'Hola, ¿cómo estás?', 'Hello, how are you?']
    ],
    ja: [
      ['船', 'ship', '船は港にあります。', 'The ship is in the harbor.', 'fune'],
      ['海', 'sea', '海は静かです。', 'The sea is calm.', 'umi'],
      ['水', 'water', '水を飲みます。', 'I drink water.', 'mizu'],
      ['島', 'island', 'あの島は小さいです。', 'That island is small.', 'shima'],
      ['港', 'harbor', '港に行きます。', 'I am going to the harbor.', 'minato'],
      ['風', 'wind', '風が強いです。', 'The wind is strong.', 'kaze'],
      ['太陽', 'sun', '太陽が輝いています。', 'The sun is shining.', 'taiyō'],
      ['月', 'moon', '月が見えます。', 'I can see the moon.', 'tsuki'],
      ['星', 'star', '星がきれいです。', 'The stars are beautiful.', 'hoshi'],
      ['魚', 'fish', '魚が泳いでいます。', 'The fish is swimming.', 'sakana'],
      ['浜辺', 'beach', '浜辺を歩きます。', 'I walk along the beach.', 'hamabe'],
      ['地図', 'map', '地図を見ます。', 'I look at the map.', 'chizu'],
      ['コンパス', 'compass', 'コンパスは北を指しています。', 'The compass points north.', 'konpasu'],
      ['橋', 'bridge', '橋を渡ります。', 'I cross the bridge.', 'hashi'],
      ['切符', 'ticket', '切符を買います。', 'I buy a ticket.', 'kippu'],
      ['電車', 'train', '電車が来ます。', 'The train is coming.', 'densha'],
      ['家', 'house', '家は近いです。', 'The house is nearby.', 'ie'],
      ['友達', 'friend', '友達と話します。', 'I talk with my friend.', 'tomodachi'],
      ['食べ物', 'food', '食べ物を買います。', 'I buy food.', 'tabemono'],
      ['こんにちは', 'hello', 'こんにちは、お元気ですか。', 'Hello, how are you?', 'konnichiwa']
    ],
    fr: [
      ['bateau', 'ship', 'Le bateau est dans le port.', 'The ship is in the harbor.'],
      ['mer', 'sea', 'La mer est calme.', 'The sea is calm.'],
      ['eau', 'water', 'Je bois de l’eau.', 'I drink water.'],
      ['île', 'island', 'Cette île est petite.', 'This island is small.'],
      ['port', 'harbor', 'Nous allons au port.', 'We are going to the harbor.'],
      ['vent', 'wind', 'Le vent est fort.', 'The wind is strong.'],
      ['soleil', 'sun', 'Le soleil brille.', 'The sun is shining.'],
      ['lune', 'moon', 'Je vois la lune.', 'I see the moon.'],
      ['étoile', 'star', 'Une étoile brille dans le ciel.', 'A star shines in the sky.'],
      ['poisson', 'fish', 'Le poisson nage dans l’eau.', 'The fish swims in the water.'],
      ['plage', 'beach', 'Nous marchons sur la plage.', 'We walk on the beach.'],
      ['carte', 'map', 'J’ai besoin d’une carte.', 'I need a map.'],
      ['boussole', 'compass', 'La boussole indique le nord.', 'The compass points north.'],
      ['pont', 'bridge', 'Nous traversons le pont.', 'We cross the bridge.'],
      ['billet', 'ticket', 'J’achète un billet de train.', 'I buy a train ticket.'],
      ['train', 'train', 'Le train arrive bientôt.', 'The train arrives soon.'],
      ['maison', 'house', 'Ma maison est près d’ici.', 'My house is near here.'],
      ['ami', 'friend', 'Mon ami parle français.', 'My friend speaks French.'],
      ['nourriture', 'food', 'La nourriture est délicieuse.', 'The food is delicious.'],
      ['bonjour', 'hello', 'Bonjour, comment allez-vous ?', 'Hello, how are you?']
    ],
    zh: [
      ['船', 'ship', '船在港口。', 'The ship is in the harbor.', 'chuán'],
      ['大海', 'sea', '大海很平静。', 'The sea is calm.', 'dà hǎi'],
      ['水', 'water', '我想喝水。', 'I want to drink water.', 'shuǐ'],
      ['岛', 'island', '那个岛很小。', 'That island is small.', 'dǎo'],
      ['港口', 'harbor', '我们去港口。', 'We are going to the harbor.', 'gǎng kǒu'],
      ['风', 'wind', '今天风很大。', 'The wind is strong today.', 'fēng'],
      ['太阳', 'sun', '太阳出来了。', 'The sun has come out.', 'tài yáng'],
      ['月亮', 'moon', '我看见月亮了。', 'I can see the moon.', 'yuè liang'],
      ['星星', 'star', '天上有很多星星。', 'There are many stars in the sky.', 'xīng xing'],
      ['鱼', 'fish', '鱼在水里游。', 'The fish swims in the water.', 'yú'],
      ['海滩', 'beach', '我们在海滩散步。', 'We walk on the beach.', 'hǎi tān'],
      ['地图', 'map', '我需要一张地图。', 'I need a map.', 'dì tú'],
      ['指南针', 'compass', '指南针可以帮助我们找到方向。', 'A compass can help us find our way.', 'zhǐ nán zhēn'],
      ['桥', 'bridge', '我们过桥吧。', 'Let’s cross the bridge.', 'qiáo'],
      ['车票', 'ticket', '我买了一张车票。', 'I bought a ticket.', 'chē piào'],
      ['火车', 'train', '火车快到了。', 'The train will arrive soon.', 'huǒ chē'],
      ['房子', 'house', '那座房子很漂亮。', 'That house is beautiful.', 'fáng zi'],
      ['朋友', 'friend', '我的朋友会说中文。', 'My friend can speak Chinese.', 'péng you'],
      ['食物', 'food', '这里的食物很好吃。', 'The food here is delicious.', 'shí wù'],
      ['你好', 'hello', '你好，很高兴认识你。', 'Hello, nice to meet you.', 'nǐ hǎo']
    ],
    de: [
      ['Schiff', 'ship', 'Das Schiff ist im Hafen.', 'The ship is in the harbor.'],
      ['Meer', 'sea', 'Das Meer ist ruhig.', 'The sea is calm.'],
      ['Wasser', 'water', 'Ich trinke Wasser.', 'I drink water.'],
      ['Insel', 'island', 'Die Insel ist klein.', 'The island is small.'],
      ['Hafen', 'harbor', 'Wir gehen zum Hafen.', 'We are going to the harbor.'],
      ['Wind', 'wind', 'Der Wind ist stark.', 'The wind is strong.'],
      ['Sonne', 'sun', 'Die Sonne scheint.', 'The sun is shining.'],
      ['Mond', 'moon', 'Ich sehe den Mond.', 'I see the moon.'],
      ['Stern', 'star', 'Ein Stern leuchtet am Himmel.', 'A star shines in the sky.'],
      ['Fisch', 'fish', 'Der Fisch schwimmt im Wasser.', 'The fish swims in the water.'],
      ['Strand', 'beach', 'Wir gehen am Strand spazieren.', 'We walk along the beach.'],
      ['Karte', 'map', 'Ich brauche eine Karte.', 'I need a map.'],
      ['Kompass', 'compass', 'Der Kompass zeigt nach Norden.', 'The compass points north.'],
      ['Brücke', 'bridge', 'Wir gehen über die Brücke.', 'We cross the bridge.'],
      ['Fahrkarte', 'ticket', 'Ich kaufe eine Fahrkarte.', 'I buy a ticket.'],
      ['Zug', 'train', 'Der Zug kommt bald.', 'The train arrives soon.'],
      ['Haus', 'house', 'Mein Haus ist in der Nähe.', 'My house is nearby.'],
      ['Freund', 'friend', 'Mein Freund spricht Deutsch.', 'My friend speaks German.'],
      ['Essen', 'food', 'Das Essen ist lecker.', 'The food is delicious.'],
      ['Hallo', 'hello', 'Hallo, wie geht es dir?', 'Hello, how are you?']
    ],
    ko: [
      ['배', 'ship', '배가 항구에 있어요.', 'The ship is in the harbor.', 'bae'],
      ['바다', 'sea', '바다가 잔잔해요.', 'The sea is calm.', 'bada'],
      ['물', 'water', '물을 마셔요.', 'I drink water.', 'mul'],
      ['섬', 'island', '저 섬은 작아요.', 'That island is small.', 'seom'],
      ['항구', 'harbor', '항구에 가요.', 'I am going to the harbor.', 'hanggu'],
      ['바람', 'wind', '바람이 강해요.', 'The wind is strong.', 'baram'],
      ['해', 'sun', '해가 떴어요.', 'The sun has risen.', 'hae'],
      ['달', 'moon', '달이 보여요.', 'I can see the moon.', 'dal'],
      ['별', 'star', '별이 반짝여요.', 'The stars twinkle.', 'byeol'],
      ['물고기', 'fish', '물고기가 헤엄쳐요.', 'The fish is swimming.', 'mulgogi'],
      ['해변', 'beach', '해변을 걸어요.', 'I walk along the beach.', 'haebyeon'],
      ['지도', 'map', '지도가 필요해요.', 'I need a map.', 'jido'],
      ['나침반', 'compass', '나침반은 북쪽을 가리켜요.', 'The compass points north.', 'nachimban'],
      ['다리', 'bridge', '다리를 건너요.', 'I cross the bridge.', 'dari'],
      ['표', 'ticket', '기차표를 사요.', 'I buy a train ticket.', 'pyo'],
      ['기차', 'train', '기차가 곧 와요.', 'The train arrives soon.', 'gicha'],
      ['집', 'house', '우리 집은 가까워요.', 'Our house is nearby.', 'jip'],
      ['친구', 'friend', '친구와 이야기해요.', 'I talk with my friend.', 'chingu'],
      ['음식', 'food', '음식이 맛있어요.', 'The food is delicious.', 'eumsik'],
      ['안녕하세요', 'hello', '안녕하세요, 만나서 반가워요.', 'Hello, nice to meet you.', 'annyeonghaseyo']
    ]
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function clean(value, max) { return typeof value === 'string' ? value.trim().slice(0, max || 2000) : ''; }
  function pick(object, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = clean(object[keys[i]]);
      if (value) return value;
    }
    return '';
  }
  function languageCode(value, fallback) {
    var code = clean(value, 35).replace(/_/g, '-');
    return /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(code) ? code : fallback;
  }
  function safeAudio(value) {
    var url = clean(value, 4096);
    return /^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url) || /^\.\.?\//.test(url) ? url : '';
  }
  function languageLabel(code) {
    var base = String(code).split('-')[0];
    var found = languages.find(function (entry) { return entry.code === base; });
    return found ? found.label : code;
  }
  function defaultPack(code) {
    code = code || 'es';
    var base = code.split('-')[0];
    if (!rows[base]) throw new Error('Choose a starter language or import your own ' + languageLabel(code) + ' words.');
    return {
      primaryLanguage: 'en',
      learningLanguage: code,
      title: languageLabel(base) + ' · Ocean & travel',
      words: rows[base].map(function (row, index) {
        var word = { id: base + '-' + (index + 1), word: row[0], translation: row[1], sentence: row[2], sentenceTranslation: row[3] };
        if (row[4]) word.romanization = row[4];
        return word;
      })
    };
  }

  function parseLines(text) {
    var lines = text.split(/\r?\n/).filter(function (line) { return line.trim(); });
    if (lines.length > MAX_ENTRIES) throw new Error('Please import no more than ' + MAX_ENTRIES + ' entries at a time.');
    return lines.map(function (line, index) {
      var delimiter = line.includes('\t') ? '\t' : (line.includes('|') ? '|' : ';');
      var parts = line.split(delimiter).map(function (part) { return part.trim(); });
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        throw new Error('Line ' + (index + 1) + ': use word | translation, with one entry on each line.');
      }
      return { word: parts[0], translation: parts[1], sentence: parts[2] || '', sentenceTranslation: parts[3] || '' };
    });
  }

  function normalizePayload(input, options) {
    options = options || {};
    var defaults = {
      primaryLanguage: languageCode(options.primaryLanguage || options.translationLanguage, 'en'),
      learningLanguage: languageCode(options.learningLanguage, 'es')
    };
    // The shared GoLingo gallery forwards these collections without renaming them.
    // Canonical collections come first so duplicate alias copies keep their data.
    var collectionKeys = ['words', 'sentences', 'phrases', 'items', 'entries'];
    var metadata = {};
    var depth = 0;
    function unwrap(value) {
      if (++depth > 8) throw new Error('The import has too many nested wrappers. Use a words or sentences array.');
      if (typeof value === 'string') {
        if (value.length > MAX_INPUT) throw new Error('This import is too large. Please use a file smaller than 1 MB.');
        value = value.trim().replace(/^\uFEFF/, '');
        if (!value) throw new Error('Add at least one word and its translation.');
        if (/^[\[{"]/.test(value)) {
          try { return unwrap(JSON.parse(value)); }
          catch (error) {
            if (error instanceof SyntaxError) throw new Error('The JSON is not valid. Check its quotation marks, commas, and brackets.');
            throw error;
          }
        }
        return { words: parseLines(value) };
      }
      if (Array.isArray(value)) return { words: value };
      if (!value || typeof value !== 'object') throw new Error('Import a JSON object, an array, or lines of word | translation.');
      ['primaryLanguage', 'translationLanguage', 'learningLanguage', 'title'].forEach(function (key) {
        if (typeof value[key] === 'string') metadata[key] = value[key];
      });
      if (collectionKeys.some(function (key) { return Array.isArray(value[key]); })) return value;
      var wrapper = ['data', 'payload', 'content'].find(function (key) { return value[key] != null; });
      if (wrapper) return unwrap(value[wrapper]);
      if (pick(value, ['word', 'text', 'learningText', 'target', 'sentence', 'phrase'])) return { words: [value] };
      throw new Error('No learning entries found. Use a words or sentences array.');
    }
    var payload = unwrap(input);
    var inputEntries = [];
    collectionKeys.forEach(function (key) {
      if (!Array.isArray(payload[key])) return;
      // Apply the shared limit before deduplication, across every supplied array.
      if (inputEntries.length + payload[key].length > MAX_ENTRIES) throw new Error('Please import no more than ' + MAX_ENTRIES + ' entries at a time.');
      payload[key].forEach(function (item) {
        inputEntries.push({ item: item, sentence: key === 'sentences' || key === 'phrases' });
      });
    });
    if (!inputEntries.length) throw new Error('The learning list is empty. Add at least one word and translation.');
    var seen = new Set();
    var ids = new Set();
    var words = inputEntries.map(function (entry, index) {
      var item = entry.item;
      if (typeof item === 'string') item = parseLines(item)[0];
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Entry ' + (index + 1) + ' must contain a word and translation.');
      var isSentence = entry.sentence || item.kind === 'sentence' || (!pick(item, ['word', 'text', 'learningText', 'target']) && !!pick(item, ['sentence', 'phrase']));
      var word = pick(item, isSentence ? ['sentence', 'phrase', 'text', 'word', 'learningText', 'target'] : ['word', 'text', 'learningText', 'target']);
      var translation = pick(item, isSentence ? ['sentenceTranslation', 'phraseTranslation', 'translation', 'meaning', 'translationText', 'nativeText'] : ['translation', 'meaning', 'translationText', 'nativeText']);
      if (!word || !translation) throw new Error('Entry ' + (index + 1) + ' is missing ' + (!word ? 'a word or sentence' : 'its translation') + '.');
      var dedupeKey = word + '\u0000' + translation;
      if (seen.has(dedupeKey)) return null;
      seen.add(dedupeKey);
      var baseId = clean(typeof item.id === 'number' ? String(item.id) : item.id, 160) || 'import-' + (index + 1);
      var id = baseId;
      var suffix = 1;
      while (ids.has(id)) id = baseId + '-' + (++suffix);
      ids.add(id);
      var normalized = {
        id: id,
        word: word,
        translation: translation,
        sentence: isSentence ? word : pick(item, ['sentence', 'example', 'exampleSentence']),
        sentenceTranslation: isSentence ? translation : pick(item, ['sentenceTranslation', 'exampleTranslation'])
      };
      if (isSentence) normalized.kind = 'sentence';
      var romanization = pick(item, ['romanization', 'pronunciation', 'pinyin', 'romaji']);
      if (romanization) normalized.romanization = romanization;
      var audio = safeAudio(pick(item, ['audioURL', 'audioUrl', 'audio', 'wordAudioURL', 'wordAudioUrl', 'soundURL']));
      var sentenceAudio = safeAudio(pick(item, ['sentenceAudioURL', 'sentenceAudioUrl', 'exampleAudioURL']));
      if (audio) normalized.audioURL = audio;
      if (sentenceAudio) normalized.sentenceAudioURL = sentenceAudio;
      return normalized;
    }).filter(Boolean);
    if (!words.length) throw new Error('No valid learning entries were found.');
    return {
      primaryLanguage: languageCode(payload.primaryLanguage || metadata.primaryLanguage || payload.translationLanguage || metadata.translationLanguage, defaults.primaryLanguage),
      learningLanguage: languageCode(payload.learningLanguage || metadata.learningLanguage, defaults.learningLanguage),
      title: clean(payload.title || metadata.title, 100) || 'My learning list',
      words: words
    };
  }

  function shuffle(items, rng) {
    rng = typeof rng === 'function' ? rng : Math.random;
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var randomValue = Number(rng());
      if (!Number.isFinite(randomValue)) randomValue = 0;
      var j = Math.min(i, Math.max(0, Math.floor(randomValue * (i + 1))));
      var temp = result[i]; result[i] = result[j]; result[j] = temp;
    }
    return result;
  }
  function makeDeck(pack, rng) {
    if (!pack || !Array.isArray(pack.words) || !pack.words.length) throw new Error('Load a learning list before starting.');
    return shuffle(clone(pack.words), rng);
  }
  function makeQuestion(item, allItems, rng) {
    if (!item || !clean(item.word) || !clean(item.translation)) throw new Error('A question needs a word and translation.');
    var answer = clean(item.translation);
    var translations = (Array.isArray(allItems) ? allItems : []).map(function (entry) { return clean(entry.translation); });
    var unique = Array.from(new Set(translations.filter(function (text) { return text && text !== answer; })));
    var distractors = shuffle(unique, rng).slice(0, 3).map(function (text) { return { text: text, correct: false }; });
    return { prompt: item.word, choices: shuffle([{ text: answer, correct: true }].concat(distractors), rng), answer: answer };
  }
  function exportPayload(pack, items) {
    var words = items === undefined ? pack.words : items;
    if (!Array.isArray(words)) throw new Error('Choose words to export.');
    return { primaryLanguage: pack.primaryLanguage, learningLanguage: pack.learningLanguage, words: clone(words) };
  }
  function shipPhrase(pack, shipIndex) {
    if (!pack || !Array.isArray(pack.words)) return null;
    var phrases = pack.words.filter(function (item) { return clean(item.sentence) && clean(item.sentenceTranslation); });
    if (!phrases.length) return null;
    var item = phrases[((Math.trunc(shipIndex || 0) % phrases.length) + phrases.length) % phrases.length];
    return { sentence: item.sentence, sentenceTranslation: item.sentenceTranslation, text: item.sentence, translation: item.sentenceTranslation, audioURL: item.sentenceAudioURL || (item.kind === 'sentence' ? item.audioURL : '') || '', sourceId: item.id };
  }

  return { languages: languages, defaultPack: defaultPack, normalizePayload: normalizePayload, makeDeck: makeDeck, makeQuestion: makeQuestion, exportPayload: exportPayload, shipPhrase: shipPhrase, languageLabel: languageLabel, maxEntries: MAX_ENTRIES };
});
