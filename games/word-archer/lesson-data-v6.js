// Word Archer v6: pure lesson parsing and deck helpers. No rendering dependency.
export const SAMPLE_WORDS = [
  ['水','water','水を飲みます。','I drink water.'],
  ['山','mountain','山が見えます。','I can see the mountain.'],
  ['空','sky','空が青いです。','The sky is blue.'],
  ['風','wind','風が吹いています。','The wind is blowing.'],
  ['森','forest','森を歩きます。','I walk in the forest.'],
  ['花','flower','花が咲きました。','The flower bloomed.'],
  ['光','light','光が差します。','Light shines through.'],
  ['鳥','bird','鳥が飛んでいます。','A bird is flying.'],
  ['弓','bow','弓を引きます。','I draw a bow.'],
  ['矢','arrow','矢を放ちます。','I release an arrow.'],
  ['的','target','的を狙います。','I aim at the target.'],
  ['勇気','courage','勇気を出します。','I find my courage.'],
  ['友達','friend','友達と遊びます。','I play with a friend.'],
  ['夢','dream','夢を見ます。','I have a dream.'],
  ['星','star','星が光っています。','The star is shining.'],
  ['心','heart','心が温かいです。','My heart feels warm.'],
  ['海','sea','海がきれいです。','The sea is beautiful.'],
  ['川','river','川が流れます。','The river flows.'],
  ['太陽','sun','太陽が昇ります。','The sun rises.'],
  ['集中','focus','集中してください。','Please concentrate.']
].map(([word,translation,sentence,sentenceTranslation],i)=>({id:String(i+1),word,translation,sentence,sentenceTranslation,audioUrl:''}));

const LANG_NAMES={english:'en',chinese:'zh-CN',japanese:'ja',spanish:'es',french:'fr',german:'de',vietnamese:'vi',korean:'ko',portuguese:'pt',italian:'it',russian:'ru',thai:'th',arabic:'ar',hindi:'hi'};
export function normalizedLanguage(value,fallback){
  const text=String(value||'').trim();
  return LANG_NAMES[text.toLowerCase()]||text||fallback;
}

export function normalizePayload(input){
  let candidate=input;
  for(let depth=0;depth<6;depth++){
    if(typeof candidate==='string'){
      try{candidate=JSON.parse(candidate);}catch{return null;}
    }
    if(Array.isArray(candidate))break;
    if(!candidate||typeof candidate!=='object')return null;
    if(Array.isArray(candidate.words)||Array.isArray(candidate.sentences)||Array.isArray(candidate.items)||Array.isArray(candidate.vocabulary)||Array.isArray(candidate.list))break;
    const next=candidate.payload??candidate.data??candidate.gameData??candidate.golingoData??candidate.content;
    if(next==null||next===candidate)return null;
    candidate=next;
  }
  const list=Array.isArray(candidate)?candidate:(candidate?.words??candidate?.sentences??candidate?.items??candidate?.vocabulary??candidate?.list);
  if(!Array.isArray(list))return null;
  const seen=new Set();
  const words=[];
  list.slice(0,1200).forEach((entry,i)=>{
    const raw=typeof entry==='string'?{word:entry}:entry;
    if(!raw||typeof raw!=='object')return;
    const word=String(raw.word??raw.term??raw.text??raw.learningText??raw.sentence??raw.phrase??'').trim();
    if(!word||seen.has(word))return;
    seen.add(word);
    words.push({
      id:String(raw.id??i+1),word,
      translation:String(raw.translation??raw.meaning??raw.definition??raw.primaryText??raw.sentenceTranslation??'').trim(),
      sentence:String(raw.sentence??'').trim(),sentenceTranslation:String(raw.sentenceTranslation??'').trim(),
      audioUrl:String(raw.audioUrl??raw.audioURL??raw.audio??'').trim()
    });
  });
  if(!words.length)return null;
  const source=Array.isArray(candidate)?{}:candidate;
  return {
    words,
    primaryLanguage:normalizedLanguage(source.primaryLanguage??source.primaryLang??source.sourceLanguage??source.baseLanguage,'en'),
    learningLanguage:normalizedLanguage(source.learningLanguage??source.learningLang??source.targetLanguage??source.language,'ja')
  };
}

export function shuffledIndexes(length,random=Math.random){
  const result=Array.from({length},(_,i)=>i);
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}

