/* Local lesson formats. No translation service or fixed language list is used. */
const aliases=new Map([['sentence','sentences'],['sentences','sentences'],['phrase','phrases'],['phrases','phrases'],['word','phrases'],['words','phrases'],['words/phrases','phrases'],['words and phrases','phrases'],['vocabulary','phrases']]);
export const DEMO_TEXT=`sentences\nlanguage: es-ES\ntranslationLanguage: en-US\nMe gusta esquiar. | I like skiing.\nLa montaña es hermosa. | The mountain is beautiful.\nQuiero aprender algo nuevo. | I want to learn something new.`;
export const PHRASE_DEMO=`phrases\nlanguage: es-ES\ntranslationLanguage: en-US\nhola | hello\nbuenos días | good morning\npor favor | please\nmuchas gracias | thank you very much\n¿Dónde está la estación? | Where is the station?`;
export const SENTENCE_EXAMPLE={type:'sentences',language:'es-ES',translationLanguage:'en-US',items:[{text:'Me gusta esquiar.',translation:'I like skiing.',words:[{text:'Me',translation:'I / me'},{text:'gusta',translation:'like'},{text:'esquiar',translation:'to ski'}]},{text:'La montaña es hermosa.',translation:'The mountain is beautiful.'}]};
export const PHRASE_EXAMPLE={type:'phrases',language:'es-ES',translationLanguage:'en-US',items:[{text:'hola',translation:'hello'},{text:'buenos días',translation:'good morning'},{text:'muchas gracias',translation:'thank you very much'}]};
export function normalizeMode(v,fallback='sentences'){return aliases.get(String(v||'').toLowerCase().trim())||fallback;}
function locale(value,fallback){const x=String(value||fallback||'').trim();if(!x)return '';try{return Intl.getCanonicalLocales(x)[0]||'';}catch{throw Error(`“${x}” is not a language code. Try a code such as es-ES, en-US or ja-JP.`);}}
function pair(line){for(const sep of ['\t','|',' => ']){const i=line.indexOf(sep);if(i>=0)return {text:line.slice(0,i).trim(),translation:line.slice(i+sep.length).trim()};}return {text:line.trim(),translation:''};}
function item(v,index){
 if(typeof v==='string')v=pair(v);
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error(`Item ${index+1} must contain text and an optional translation.`);
 const text=String(v.text??v.sentence??v.phrase??v.word??v.term??v.source??v.original??'').trim();
 if(!text)throw Error(`Item ${index+1} has no learning text.`);
 if(text.length>6000)throw Error(`Item ${index+1} is too long. Split it into shorter lines.`);
 const out={text,translation:String(v.translation??v.translated??v.meaning??v.definition??'').trim()};
 const words=v.words??v.tokens;
 if(Array.isArray(words)&&words.length)out.words=words.map((w,i)=>{if(typeof w==='string')return {text:w.trim(),translation:''};return item(w,i);}).filter(w=>w.text);
 return out;
}
export function tokenizeSentence(text,language=''){
 try{if(Intl.Segmenter){const s=new Intl.Segmenter(language||undefined,{granularity:'word'});const words=Array.from(s.segment(text)).filter(x=>x.isWordLike).map(x=>({text:x.segment,translation:''}));if(words.length)return words;}}catch{}
 return (String(text).match(/[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu)||[]).map(text=>({text,translation:''}));
}
export function sentenceUnits(it,language){return it.words?.length?it.words.map(w=>({...w})):tokenizeSentence(it.text,language);}
export function parseLesson(input,options={}){
 let obj=input,metadata={},fallback=normalizeMode(options.mode),raw='';
 if(typeof input==='string'){
  raw=input.replace(/^\uFEFF/,'').trim();if(!raw)throw Error('Add at least one sentence, word or phrase.');
  if(raw.startsWith('{')||raw.startsWith('[')){try{obj=JSON.parse(raw);}catch{throw Error('The JSON is not valid. Check its quotation marks, commas and brackets.');}}
  else{
   const rows=raw.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);let mode=fallback;
   const first=rows[0].replace(/^#\s*/,'').replace(/^(type|mode)\s*[:=]\s*/i,'').replace(/:$/,'').toLowerCase();
   if(aliases.has(first)){mode=normalizeMode(first);rows.shift();}
   const entries=[];for(const line of rows){const m=line.match(/^(language|lang|learningLanguage|translationLanguage|nativeLanguage)\s*[:=]\s*(.+)$/i);if(m){metadata[m[1].toLowerCase()]=m[2].trim();continue;}if(line.startsWith('#'))continue;entries.push(pair(line));}
   obj={type:mode,language:metadata.language??metadata.lang??metadata.learninglanguage,translationLanguage:metadata.translationlanguage??metadata.nativelanguage,items:entries};
  }
 }
 if(Array.isArray(obj))obj={type:fallback,items:obj};
 if(!obj||typeof obj!=='object')throw Error('Use a lesson object or a list of learning items.');
 const mode=normalizeMode(obj.mode??obj.type,obj.sentences?'sentences':obj.phrases||obj.words?'phrases':fallback);
 const language=locale(obj.language??obj.lang??obj.learningLanguage??obj.sourceLanguage,options.language||'es-ES');
 const translationLanguage=locale(obj.translationLanguage??obj.nativeLanguage??obj.primaryLanguage,options.translationLanguage||'en-US');
 const entries=obj.items??obj.entries??obj.sentences??obj.phrases??obj.words;
 if(!Array.isArray(entries)||!entries.length)throw Error('Add at least one learning item in an items, sentences, phrases or words list.');
 if(entries.length>1000)throw Error('This lesson has more than 1,000 items. Import a smaller list.');
 const items=entries.map(item);
 if(mode==='sentences')for(const [i,it]of items.entries()){const n=sentenceUnits(it,language).length;if(!n)throw Error(`Sentence ${i+1} has no words to learn.`);if(n>240)throw Error(`Sentence ${i+1} has more than 240 words. Split it into shorter lines.`);}
 return {version:1,mode,language,translationLanguage,items};
}
export function lessonRunCount(lesson){return lesson.mode==='sentences'?lesson.items.length:Math.ceil(lesson.items.length/48);}
export function lessonRun(lesson,index=0){
 const count=lessonRunCount(lesson);index=Math.max(0,Math.min(count-1,index));
 if(lesson.mode==='sentences'){const it=lesson.items[index];return {index,count,mode:lesson.mode,text:it.text,translation:it.translation,units:sentenceUnits(it,lesson.language),language:lesson.language,translationLanguage:lesson.translationLanguage};}
 const items=lesson.items.slice(index*48,(index+1)*48);
 return {index,count,mode:lesson.mode,text:items.map(v=>v.text).join(' · '),translation:items.map(v=>v.translation).join(' · '),units:items.map(v=>({...v})),language:lesson.language,translationLanguage:lesson.translationLanguage};
}
export function lessonJSON(lesson){return {type:lesson.mode,language:lesson.language,translationLanguage:lesson.translationLanguage,items:lesson.items};}
// The main GoLingo games page passes lessons in the hash, which is not sent
// to hosting servers. Also accept ?lesson= for existing app integrations.
export function lessonFromURL(location){
 if(!location)return null;const hash=new URLSearchParams(String(location.hash||'').replace(/^#/,'')),query=new URLSearchParams(location.search||'');
 const raw=hash.get('golingoLesson')??hash.get('lesson')??query.get('lesson');if(!raw)return null;
 if(raw.length>200000)throw Error('The shared lesson is too large. Import it as a JSON file.');return parseLesson(raw);
}
