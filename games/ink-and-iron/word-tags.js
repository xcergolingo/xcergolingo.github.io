import * as THREE from './vendor/three.module.js';

// A vocabulary label belongs to its robot; it never intercepts player input.
export function createWordTag(entry, settings, selected=false) {
  const group=new THREE.Group(),canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=240;
  const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false});
  const sprite=new THREE.Sprite(material);sprite.position.y=2.92;sprite.scale.set(3.65,1.14,1);group.add(sprite);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.78,.91,28),new THREE.MeshBasicMaterial({color:'#ffc943',transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=.035;group.add(ring);
  let focused=selected,options={...settings};
  const fit=(text,y,size,maxWidth,color)=>{const value=String(text||'');let font=size;ctx.font=`800 ${font}px Arial, sans-serif`;while(font>24&&ctx.measureText(value).width>maxWidth){font-=2;ctx.font=`800 ${font}px Arial, sans-serif`;}const chars=[...value];let shown=value;if(ctx.measureText(shown).width>maxWidth){while(chars.length&&ctx.measureText(chars.join('')+'…').width>maxWidth)chars.pop();shown=chars.join('')+'…';}ctx.fillStyle=color;ctx.direction=/[\u0590-\u08ff]/.test(shown)?'rtl':'ltr';ctx.fillText(shown,384,y,maxWidth);};
  function draw(){
    ctx.clearRect(0,0,768,240);const visible=options.showWord||options.showTranslation;
    sprite.visible=Boolean(visible);ring.visible=focused;
    if(!visible)return;
    ctx.fillStyle=focused?'#ffc943':'#fff1cd';ctx.strokeStyle='#191827';ctx.lineWidth=10;ctx.beginPath();ctx.roundRect(6,8,756,204,24);ctx.fill();ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';
    if(options.showWord){fit(entry.word,options.showTranslation?91:111,62,706,'#191827');}
    if(options.showTranslation){fit(entry.translation||'—',options.showWord?159:113,options.showWord?33:49,700,options.showWord?'#51405e':'#191827');}
    if(focused){ctx.fillStyle='#191827';ctx.beginPath();ctx.moveTo(370,212);ctx.lineTo(398,212);ctx.lineTo(384,238);ctx.fill();}
    texture.needsUpdate=true;
  }
  draw();
  return {group,entry,setSelected(value){if(focused!==Boolean(value)){focused=Boolean(value);draw();}},setSettings(value){options={...value};draw();},update(time){if(focused)ring.material.opacity=.55+Math.sin(time*4)*.18;},dispose(){group.removeFromParent();texture.dispose();material.dispose();ring.geometry.dispose();ring.material.dispose();}};
}
