import * as THREE from 'three';

const roundRect=(ctx,x,y,w,h,r)=>{
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.closePath();
};
const fitLines=(ctx,text,maxWidth,maxLines=2)=>{
  const value=String(text||'');if(!value)return [''];
  const units=/\s/.test(value)?value.split(/\s+/):Array.from(value);
  const joiner=/\s/.test(value)?' ':'';
  const lines=[];let line='';
  for(const unit of units){
    const next=line?line+joiner+unit:unit;
    if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=unit;}
    else line=next;
    if(lines.length===maxLines-1)break;
  }
  if(lines.length<maxLines)lines.push(line||value);
  return lines;
};

function buildTexture(item,showTranslation,active){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=196;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,512,196);
  ctx.shadowColor=active?'#ffdd5c99':'#0b142aa0';ctx.shadowBlur=active?20:14;
  ctx.fillStyle=active?'#fff4b6':'#1c3351';
  roundRect(ctx,10,12,492,172,29);ctx.fill();
  ctx.shadowBlur=0;
  ctx.lineWidth=active?10:5;ctx.strokeStyle=active?'#ffb631':'#9bdbef';ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';
  let size=82;
  if(item.word.length>9)size=58;if(item.word.length>19)size=42;
  if(item.word.length>36)size=32;
  ctx.fillStyle=active?'#593c26':'#fffcef';
  ctx.font=`900 ${size}px system-ui,'Noto Sans CJK JP','Noto Sans',sans-serif`;
  const lines=fitLines(ctx,item.word,448,2);
  if(lines.length===1){ctx.fillText(lines[0],256,showTranslation?78:99,446);}
  else{ctx.fillText(lines[0],256,59,446);ctx.fillText(lines[1],256,111,446);}
  if(showTranslation&&item.translation){
    ctx.fillStyle=active?'#9e6944':'#92dbea';ctx.font="700 33px system-ui,'Noto Sans',sans-serif";
    ctx.fillText(item.translation,256,158,451);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;
  return texture;
}

export function refreshTargetLabels(targets,{showWords=true,showTranslation=false},activeTarget){
  for(const target of targets){
    if(target.removed)continue;
    if(!target.wordSprite){
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({transparent:true,depthWrite:false,depthTest:true}));
      sprite.renderOrder=4;target.mesh.add(sprite);target.wordSprite=sprite;
    }
    const sprite=target.wordSprite;
    sprite.visible=showWords;
    if(!showWords)continue;
    const isActive=target===activeTarget;
    const key=[target.lesson?.word,target.lesson?.translation,showTranslation,isActive].join('|');
    if(sprite.userData.textureKey!==key){
      sprite.material.map?.dispose();
      sprite.material.map=buildTexture(target.lesson||{word:'?'},showTranslation,isActive);
      sprite.material.needsUpdate=true;sprite.userData.textureKey=key;
    }
    const scale=isActive?1.52:1.16;
    sprite.scale.set(scale,scale*.385,1);
    sprite.position.set(0,isActive?.95:.76,.08);
  }
}

export function releaseTargetLabels(targets){
  for(const target of targets){
    const sprite=target.wordSprite;
    if(sprite){target.mesh.remove(sprite);sprite.material.map?.dispose();sprite.material.dispose();target.wordSprite=null;}
  }
}
