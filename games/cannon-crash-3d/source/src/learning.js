// GoLingo's portable content format. This file stays DOM-free so data parsing
// can be tested in Node and reused by other browser games.
export const LANGUAGES=[
  ['en','English','en-US'],['zh','中文','zh-CN'],['ja','日本語','ja-JP'],
  ['vi','Tiếng Việt','vi-VN'],['es','Español','es-ES'],['pt','Português','pt-BR'],
  ['fr','Français','fr-FR'],['de','Deutsch','de-DE'],['it','Italiano','it-IT'],
  ['ko','한국어','ko-KR'],['ar','العربية','ar-SA'],['hi','हिन्दी','hi-IN'],
  ['ru','Русский','ru-RU'],['th','ไทย','th-TH'],['uk','Українська','uk-UA'],
  ['nl','Nederlands','nl-NL'],['sv','Svenska','sv-SE'],['no','Norsk','nb-NO'],
  ['da','Dansk','da-DK'],['fi','Suomi','fi-FI'],['pl','Polski','pl-PL'],
  ['tr','Türkçe','tr-TR'],['el','Ελληνικά','el-GR'],['he','עברית','he-IL'],
  ['id','Bahasa Indonesia','id-ID'],['ms','Bahasa Melayu','ms-MY'],
  ['tl','Filipino','fil-PH'],['fa','فارسی','fa-IR'],['ur','اردو','ur-PK']
].map(([code,name,voice])=>({code,name,voice}));

export const DEMO_WORDS=[
  ['水','water','水を飲みます。','I drink water.'],
  ['船','boat','船に乗ります。','I ride the boat.'],
  ['星','star','星が輝いています。','The star is shining.'],
  ['木','tree','木が高いです。','The tree is tall.'],
  ['雪','snow','雪が降っています。','It is snowing.'],
  ['家','house','家に帰ります。','I am going home.'],
  ['山','mountain','山が見えます。','I can see the mountain.'],
  ['火','fire','火は熱いです。','Fire is hot.'],
  ['空','sky','空が青いです。','The sky is blue.'],
  ['風','wind','風が強いです。','The wind is strong.'],
  ['川','river','川が流れています。','The river is flowing.'],
  ['車','car','車を運転します。','I drive a car.'],
  ['鳥','bird','鳥が飛んでいます。','A bird is flying.'],
  ['城','castle','古い城があります。','There is an old castle.'],
  ['月','moon','月が明るいです。','The moon is bright.'],
  ['太陽','sun','太陽が昇ります。','The sun rises.'],
  ['道','road','この道を歩きます。','I walk along this road.'],
  ['友達','friend','友達と遊びます。','I play with a friend.'],
  ['花','flower','花が咲いています。','The flower is blooming.'],
  ['光','light','光が見えます。','I can see the light.'],
  ['猫','cat','猫が寝ています。','The cat is sleeping.'],
  ['犬','dog','犬が走っています。','The dog is running.'],
  ['魚','fish','魚が泳いでいます。','The fish is swimming.'],
  ['町','town','町は静かです。','The town is quiet.'],
  ['本','book','本を読みます。','I read a book.'],
  ['海','sea','海がきれいです。','The sea is beautiful.'],
  ['氷','ice','氷が冷たいです。','The ice is cold.'],
  ['音楽','music','音楽を聴きます。','I listen to music.'],
  ['勇気','courage','勇気を出してください。','Please be brave.'],
  ['世界','world','世界は広いです。','The world is big.'],
  ['言葉','word','新しい言葉を覚えます。','I remember a new word.'],
  ['学ぶ','learn','毎日学びます。','I learn every day.'],
  ['遊ぶ','play','公園で遊びます。','I play at the park.'],
  ['勝つ','win','試合に勝ちました。','I won the match.']
];

export const DEMO_DATA={
  primaryLanguage:'en',learningLanguage:'ja',
  words:DEMO_WORDS.map(([word,translation,sentence,sentenceTranslation],index)=>({
    id:String(index+101),word,translation,sentence,sentenceTranslation
  }))
};

const clean=(value,length=240)=>String(value??'').replace(/[\u0000-\u0008\u000B-\u001F]/g,'').trim().slice(0,length);
const normalizeLanguage=(code,fallback)=>{
  const value=clean(code,20).toLowerCase();
  if(!value)return fallback;
  const match=LANGUAGES.find(l=>l.code===value||l.voice.toLowerCase()===value);
  return match?.code||value.split('-')[0]||fallback;
};
export const voiceFor=(code)=>LANGUAGES.find(l=>l.code===normalizeLanguage(code,'en'))?.voice||code||'en-US';
export const languageName=(code)=>LANGUAGES.find(l=>l.code===normalizeLanguage(code,'en'))?.name||code||'English';

function unwrap(raw){
  if(typeof raw==='string'){
    const value=raw.trim();if(!value)return null;
    try{return JSON.parse(value);}catch{}
    try{return JSON.parse(decodeURIComponent(value));}catch{}
    try{
      const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),ch=>ch.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    }catch{}
    return null;
  }
  if(Array.isArray(raw))return {words:raw};
  if(!raw||typeof raw!=='object')return null;
  if(raw.words||raw.sentences)return raw;
  for(const key of ['payload','data','gameData','content']){
    if(raw[key]){const unwrapped=unwrap(raw[key]);if(unwrapped)return unwrapped;}
  }
  return null;
}

export function normalizeGameData(raw){
  const source=unwrap(raw);
  if(!source)return null;
  const wordItems=Array.isArray(source.words)?source.words:[];
  const sentenceItems=Array.isArray(source.sentences)?source.sentences:[];
  const records=wordItems.length?wordItems:sentenceItems;
  const items=records.slice(0,200).map((item,i)=>{
    const record=typeof item==='string'?{word:item}:item;
    if(!record||typeof record!=='object')return null;
    const word=clean(record.word||record.text||record.phrase||record.sentence,160);
    const translation=clean(record.translation||record.meaning||record.sentenceTranslation,240);
    if(!word)return null;
    return {
      id:clean(record.id??i,60)||String(i),
      word,translation,
      sentence:clean(record.sentence||record.example,300),
      sentenceTranslation:clean(record.sentenceTranslation||record.exampleTranslation,300),
      audioUrl:clean(record.audioUrl||record.audioURL||(typeof record.audio==='string'?record.audio:record.audio?.url),600)
    };
  }).filter(Boolean);
  if(!items.length)return null;
  return {
    primaryLanguage:normalizeLanguage(source.primaryLanguage||source.baseLanguage,'en'),
    learningLanguage:normalizeLanguage(source.learningLanguage||source.targetLanguage,'ja'),
    words:items
  };
}

export const escapeHtml=(text)=>String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

// Each restart reshuffles word assignments without changing the physical layout.
export function makeLessonDeck(data,count,random=Math.random){
  const words=data.words.slice();
  for(let i=words.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[words[i],words[j]]=[words[j],words[i]];}
  return Array.from({length:count},(_,index)=>words[index%words.length]);
}

export function exportBasket(data,collected){
  return {
    primaryLanguage:data.primaryLanguage,
    learningLanguage:data.learningLanguage,
    words:collected.map(({id,word,translation,sentence,sentenceTranslation})=>({
      id,word,translation,sentence,sentenceTranslation
    }))
  };
}

export function initialGameData(search,stored,hash=''){
  // The GoLingo games gallery forwards lessons as #data=<encoded JSON> so
  // large word packs do not go into the HTTP request URI. Direct ?data= links
  // from the native app continue to work with the same priority as before.
  const sources=[new URLSearchParams(search),new URLSearchParams(hash.replace(/^#/,''))];
  for(const params of sources){
    for(const key of ['data','golingo','golingoLesson','payload','json','content','gameData']){
      if(params.has(key)){
        const parsed=normalizeGameData(params.get(key));if(parsed)return parsed;
      }
    }
    if(params.has('words')||params.has('sentences')){
      try{
        const parsed=normalizeGameData({
          primaryLanguage:params.get('primaryLanguage')||'en',
          learningLanguage:params.get('learningLanguage')||'ja',
          words:JSON.parse(params.get('words')||'[]'),
          sentences:JSON.parse(params.get('sentences')||'[]')
        });
        if(parsed)return parsed;
      }catch{}
    }
  }
  return normalizeGameData(stored)||normalizeGameData(DEMO_DATA);
}
