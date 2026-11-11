export const LANGUAGE_NAMES = {es:'Spanish',ja:'Japanese',zh:'Chinese',fr:'French',de:'German',pt:'Portuguese',vi:'Vietnamese',ko:'Korean',it:'Italian',en:'English'};
export const VOICE_CODES = {en:'en-US',es:'es-ES',ja:'ja-JP',zh:'zh-CN',fr:'fr-FR',de:'de-DE',pt:'pt-BR',vi:'vi-VN',ko:'ko-KR',it:'it-IT'};

const TRANSLATIONS = [
  ['water','I drink water.'],['sun','The sun is shining.'],['friend','You are my friend.'],['sky','The sky is blue.'],
  ['house','This is my house.'],['freedom','I feel free.'],['beautiful','What a beautiful day!'],['thank you','Thank you for helping me.'],
  ['hello','Hello, how are you?'],['adventure','Life is an adventure.'],['mountain','The mountain is high.'],['fly','The birds can fly.']
];
const BANKS = {
  es:['agua|Bebo agua.','sol|El sol brilla.','amigo|Eres mi amigo.','cielo|El cielo es azul.','casa|Esta es mi casa.','libertad|Me siento libre.','hermoso|¡Qué día tan hermoso!','gracias|Gracias por ayudarme.','hola|Hola, ¿cómo estás?','aventura|La vida es una aventura.','montaña|La montaña es alta.','volar|Los pájaros pueden volar.'],
  ja:['水|水を飲みます。','太陽|太陽が輝いています。','友達|あなたは私の友達です。','空|空が青いです。','家|これは私の家です。','自由|私は自由です。','美しい|何て美しい日でしょう。','ありがとう|助けてくれてありがとう。','こんにちは|こんにちは、お元気ですか。','冒険|人生は冒険です。','山|山が高いです。','飛ぶ|鳥は飛べます。'],
  zh:['水|我喝水。','太阳|太阳在照耀。','朋友|你是我的朋友。','天空|天空是蓝色的。','房子|这是我的房子。','自由|我感到自由。','美丽|多么美丽的一天！','谢谢|谢谢你帮助我。','你好|你好，你怎么样？','冒险|生活是一场冒险。','山|这座山很高。','飞|鸟会飞。'],
  fr:['eau|Je bois de l’eau.','soleil|Le soleil brille.','ami|Tu es mon ami.','ciel|Le ciel est bleu.','maison|C’est ma maison.','liberté|Je me sens libre.','beau|Quelle belle journée !','merci|Merci pour ton aide.','bonjour|Bonjour, comment ça va ?','aventure|La vie est une aventure.','montagne|La montagne est haute.','voler|Les oiseaux peuvent voler.'],
  de:['Wasser|Ich trinke Wasser.','Sonne|Die Sonne scheint.','Freund|Du bist mein Freund.','Himmel|Der Himmel ist blau.','Haus|Das ist mein Haus.','Freiheit|Ich fühle mich frei.','schön|Was für ein schöner Tag!','danke|Danke für deine Hilfe.','hallo|Hallo, wie geht es dir?','Abenteuer|Das Leben ist ein Abenteuer.','Berg|Der Berg ist hoch.','fliegen|Vögel können fliegen.'],
  pt:['água|Eu bebo água.','sol|O sol está brilhando.','amigo|Você é meu amigo.','céu|O céu é azul.','casa|Esta é a minha casa.','liberdade|Eu me sinto livre.','bonito|Que dia bonito!','obrigado|Obrigado por me ajudar.','olá|Olá, como vai você?','aventura|A vida é uma aventura.','montanha|A montanha é alta.','voar|Os pássaros podem voar.']
};

export function defaultDeck(language='es'){
  const words=BANKS[language]||BANKS.es;
  return words.map((entry,index)=>{
    const [word,sentence]=entry.split('|');
    return {id:String(index+1),word,translation:TRANSLATIONS[index][0],sentence,sentenceTranslation:TRANSLATIONS[index][1]};
  });
}

export function normalizePayload(raw){
  if(!raw)return null;
  if(typeof raw==='string'){
    let value=raw;
    try{value=decodeURIComponent(value);}catch{}
    try{raw=JSON.parse(value);}catch{
      try{raw=JSON.parse(decodeURIComponent(escape(atob(value))));}catch{return null;}
    }
  }
  if(raw?.type && (raw.data||raw.payload))raw=raw.data||raw.payload;
  if(Array.isArray(raw))raw={words:raw};
  if(!raw||typeof raw!=='object')return null;
  let source=raw.words||raw.sentences||raw.items||raw.vocabulary||raw.wordList;
  if(typeof source==='string'){
    try{source=JSON.parse(source);}catch{return null;}
  }
  if(!Array.isArray(source))return null;
  const words=source.map((w,index)=>{
    if(typeof w==='string')return null;
    const word=String(w?.word??w?.learningText??w?.text??w?.sentence??'').trim();
    const translation=String(w?.translation??w?.primaryText??w?.meaning??w?.sentenceTranslation??'').trim();
    if(!word||!translation)return null;
    return {id:String(w.id??index+1),word:word.slice(0,90),translation:translation.slice(0,100),sentence:String(w.sentence??'').slice(0,150),sentenceTranslation:String(w.sentenceTranslation??'').slice(0,150),audioUrl:String(w.audioUrl??w.audioURL??w.audio??w.soundUrl??'').trim().slice(0,2000)};
  }).filter(Boolean).slice(0,120);
  if(!words.length)return null;
  return {words,primaryLanguage:String(raw.primaryLanguage??raw.baseLanguage??'en').split('-')[0].toLowerCase(),learningLanguage:String(raw.learningLanguage??raw.targetLanguage??'es').split('-')[0].toLowerCase()};
}

export function findInitialPayload(){
  const params=new URLSearchParams(location.search);
  for(const key of ['data','gameData','golingo','payload','words','sentences']){
    const value=params.get(key);
    if(value){const parsed=normalizePayload(value);if(parsed)return parsed;}
  }
  if(location.hash&&location.hash.length>2){
    const hash=location.hash.slice(1);
    const candidate=hash.startsWith('golingoLesson=')?hash.slice('golingoLesson='.length):hash.startsWith('data=')?hash.slice(5):hash;
    const parsed=normalizePayload(candidate);if(parsed)return parsed;
  }
  for(const key of ['golingo-game-data','golingoGameData','GoLingoGameData','golingo-words']){
    try{const parsed=normalizePayload(localStorage.getItem(key)||sessionStorage.getItem(key));if(parsed)return parsed;}catch{}
  }
  return null;
}
