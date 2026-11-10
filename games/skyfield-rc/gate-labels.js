import * as THREE from './vendor/three.module.js';

const WIDTH=768,HEIGHT=384,PADDING_X=32,PADDING_Y=26;
const CONTENT_WIDTH=WIDTH-PADDING_X*2,CONTENT_HEIGHT=HEIGHT-PADDING_Y*2;
const FONT='"Avenir Next",Arial,"Hiragino Sans","Microsoft YaHei",sans-serif';
const MIN_WORD_SIZE=56,MAX_WORD_SIZE=196,MIN_TRANSLATION_SIZE=26;
let segmenter=null;
try{if(typeof Intl.Segmenter==='function')segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});}catch{}

function clean(value){
  return String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\s+/g,' ').trim();
}
function graphemes(value){
  if(segmenter)return Array.from(segmenter.segment(value),part=>part.segment);
  // Preserve accents, emoji modifiers and joined emoji on older web views too.
  const result=[];
  for(const character of Array.from(value)){
    if(result.length&&(/[\p{Mark}\uFE0E\uFE0F\u200D]/u.test(character)||/[\u{1F3FB}-\u{1F3FF}]/u.test(character)||result.at(-1).endsWith('\u200D'))){
      result[result.length-1]+=character;
    }else result.push(character);
  }
  return result;
}
function font(context,size,weight=700){context.font=`${weight} ${size}px ${FONT}`;}

// Keep natural word boundaries, splitting only words/CJK runs wider than a line.
// Stop once the available lines fill: long imported sentences cannot make the
// renderer measure hundreds of off-screen glyphs at every candidate font size.
function wrap(context,value,width,maxLines){
  if(!value)return {lines:[],overflow:false};
  const lines=[];let line='';
  for(const word of value.split(' ')){
    const candidate=line?`${line} ${word}`:word;
    if(context.measureText(candidate).width<=width){line=candidate;continue;}
    if(line){
      lines.push(line);line='';
      if(lines.length===maxLines)return {lines,overflow:true};
    }
    if(context.measureText(word).width<=width){line=word;continue;}
    for(const character of graphemes(word)){
      if(line&&context.measureText(line+character).width>width){
        lines.push(line);line='';
        if(lines.length===maxLines)return {lines,overflow:true};
      }
      line+=character;
    }
  }
  if(line)lines.push(line);
  return {lines,overflow:false};
}
function ellipsize(context,value,width){
  const parts=graphemes(value.trimEnd());
  while(parts.length&&context.measureText(parts.join('')+'…').width>width)parts.pop();
  return parts.join('')+'…';
}
function finishLines(context,result){
  const lines=result.lines.slice();
  if(result.overflow&&lines.length)lines[lines.length-1]=ellipsize(context,lines.at(-1),CONTENT_WIDTH);
  return lines;
}

export function layoutGateWordLabel(context,{word,translation='',showTranslation=true}){
  word=clean(word);translation=showTranslation?clean(translation):'';
  if(!word)return {wordLines:[],translationLines:[],height:0,truncated:false};
  // Words get priority over a long translation. Three lines fit inside the ring;
  // exceptional long imports end in an ellipsis while their full audio is kept.
  const reserve=translation?MIN_TRANSLATION_SIZE*1.18+10:0;
  let low=MIN_WORD_SIZE,high=MAX_WORD_SIZE,best=MIN_WORD_SIZE;
  while(low<=high){
    const size=Math.floor((low+high)/2);font(context,size);
    const result=wrap(context,word,CONTENT_WIDTH,3);
    const fits=!result.overflow&&result.lines.length*size*1.1+reserve<=CONTENT_HEIGHT;
    if(fits){best=size;low=size+1;}else high=size-1;
  }
  font(context,best);
  const wordResult=wrap(context,word,CONTENT_WIDTH,3);
  const wordLines=finishLines(context,wordResult),lineHeight=best*1.1;
  const wordHeight=wordLines.length*lineHeight;
  let translationLines=[],translationSize=0,translationLineHeight=0,translationOverflow=false,gap=0;
  if(translation){
    gap=10;
    const available=CONTENT_HEIGHT-wordHeight-gap;
    const largest=Math.floor(Math.min(64,best*.44,available/1.18));
    let lower=MIN_TRANSLATION_SIZE,upper=Math.max(lower,largest),selected=lower;
    while(lower<=upper){
      const size=Math.floor((lower+upper)/2);font(context,size,600);
      const result=wrap(context,translation,CONTENT_WIDTH,2);
      if(!result.overflow&&result.lines.length*size*1.18<=available){selected=size;lower=size+1;}else upper=size-1;
    }
    translationSize=selected;translationLineHeight=selected*1.18;font(context,selected,600);
    const maxLines=Math.max(1,Math.min(2,Math.floor(available/translationLineHeight)));
    const result=wrap(context,translation,CONTENT_WIDTH,maxLines);
    translationLines=finishLines(context,result);translationOverflow=result.overflow;
  }
  return {
    wordLines,translationLines,fontSize:best,translationFontSize:translationSize,
    lineHeight,translationLineHeight,gap,
    height:wordHeight+gap+translationLines.length*translationLineHeight,
    truncated:wordResult.overflow||translationOverflow,
    wordTruncated:wordResult.overflow,translationTruncated:translationOverflow
  };
}

/** A camera-facing word at a ring's center, shared by the main and inset views. */
export function createGateWordLabel(){
  const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Canvas text is unavailable for ring words.');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.name='Skyfield ring words';
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});
  const sprite=new THREE.Sprite(material);sprite.name='Ring vocabulary';sprite.visible=false;
  // Even the corners stay inside a 15 m ring: hypot(11,5.5) < 15.
  sprite.scale.set(22,11,1);sprite.center.set(.5,.5);
  let previousKey='',disposed=false;

  function update({word,translation='',showTranslation=true,active=true}={}){
    if(disposed)return false;
    word=clean(word);translation=clean(translation);
    material.opacity=active?1:.82;
    sprite.visible=Boolean(word);
    sprite.userData.word=word;sprite.userData.translation=translation;sprite.userData.active=Boolean(active);
    const key=JSON.stringify([word,showTranslation?translation:'']);
    if(key===previousKey)return false;
    previousKey=key;
    const layout=layoutGateWordLabel(context,{word,translation,showTranslation});
    sprite.userData.layout=layout;
    context.clearRect(0,0,WIDTH,HEIGHT);
    context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';
    let y=(HEIGHT-layout.height)/2;
    const paint=(lines,size,lineHeight,weight,color)=>{
      if(!lines.length)return;
      font(context,size,weight);context.fillStyle=color;
      context.strokeStyle='rgba(18,38,30,.96)';context.lineWidth=Math.max(4,size*.065);
      context.shadowColor='rgba(8,23,19,.55)';context.shadowBlur=8;context.shadowOffsetY=2;
      for(const line of lines){
        context.direction=/^[^A-Za-z\u3400-\u9fff]*[\u0590-\u08ff]/u.test(line)?'rtl':'ltr';
        const middle=y+lineHeight/2;
        context.strokeText(line,WIDTH/2,middle,CONTENT_WIDTH);
        context.fillText(line,WIDTH/2,middle,CONTENT_WIDTH);y+=lineHeight;
      }
    };
    paint(layout.wordLines,layout.fontSize,layout.lineHeight,700,'#fff3ba');
    y+=layout.gap||0;
    paint(layout.translationLines,layout.translationFontSize,layout.translationLineHeight,600,'#f2f8ed');
    texture.needsUpdate=true;
    return true;
  }
  function dispose(){
    if(disposed)return;disposed=true;
    sprite.removeFromParent();texture.dispose();material.dispose();
  }
  return {sprite,update,dispose};
}
