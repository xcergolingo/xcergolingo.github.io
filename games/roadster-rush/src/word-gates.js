/** One reusable, lane-aligned learning gate. All textures and meshes are local. */
export function createWordGate(THREE,scene,{lanes=[-5.4,-1.8,1.8,5.4]}={}) {
  const group=new THREE.Group();group.name='GoLingo-word-gate';scene.add(group);group.visible=false;
  const material=new THREE.MeshStandardMaterial({color:0x65dcc9,emissive:0x36baae,emissiveIntensity:.65,roughness:.45,metalness:.05});
  const footMaterial=new THREE.MeshStandardMaterial({color:0x173b42,roughness:.8});
  const postGeometry=new THREE.BoxGeometry(.13,5.7,.16),footGeometry=new THREE.BoxGeometry(.5,.15,.5);
  for(const side of [-1,1]){const post=new THREE.Mesh(postGeometry,material);post.position.set(side*1.58,2.85,0);group.add(post);const foot=new THREE.Mesh(footGeometry,footMaterial);foot.position.set(side*1.58,.08,0);group.add(foot);}
  const beam=new THREE.Mesh(new THREE.BoxGeometry(3.3,.14,.17),material);beam.position.y=5.7;group.add(beam);
  const marker=new THREE.Mesh(new THREE.PlaneGeometry(2.8,1.25),new THREE.MeshBasicMaterial({color:0x6ce8d0,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.set(0,.04,0);group.add(marker);
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=304;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('A 2D canvas is required for word gates.');
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(4.4,1.31),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));board.position.set(0,5.64,.13);group.add(board);
  let stage=null,active=false,lane=1,prefs={showWord:true,showTranslation:false};
  function shorten(value,width){let chars=Array.from(String(value||''));while(chars.length>1&&ctx.measureText(chars.join('')).width>width)chars.pop();return chars.join('')+(chars.length<Array.from(String(value||'')).length?'…':'');}
  function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
  function draw(){
    ctx.clearRect(0,0,1024,304);ctx.fillStyle='#14272ef2';roundedRect(8,8,1008,288,32);ctx.fill();
    const gold=stage?.kind==='sentence',accent=gold?'#ffd38d':'#9affdf';ctx.strokeStyle=accent;ctx.lineWidth=6;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction='inherit';ctx.fillStyle=accent;ctx.font='700 27px system-ui, sans-serif';ctx.fillText(gold?'SENTENCE FINISH':'WORD GATE',512,48);
    ctx.fillStyle='#ffffff';ctx.font='750 72px system-ui, sans-serif';
    const word=prefs.showWord?(stage?.text||stage?.word||''):'◆';ctx.fillText(shorten(word,940),512,prefs.showTranslation&&stage?.translation?143:169);
    if(prefs.showTranslation&&stage?.translation){ctx.fillStyle='#e7d5bc';ctx.font='500 40px system-ui, sans-serif';ctx.fillText(shorten(stage.translation,940),512,235);}
    texture.needsUpdate=true;
  }
  function reset(){active=false;group.visible=false;stage=null;}
  function spawn(nextStage,nextLane,z){stage=nextStage;lane=nextLane;active=true;group.position.set(lanes[lane],0,z);group.visible=true;const color=stage.kind==='sentence'?0xffd18a:0x65dcc9;material.color.setHex(color);material.emissive.setHex(color);marker.material.color.setHex(color);draw();}
  function update(dt,step,player,time){
    if(!active||!group.visible)return null;
    group.position.z+=step;marker.material.opacity=.18+Math.sin(time*3)*.05;
    if(group.position.z>=player.position.z-1.5&&Math.abs(player.position.x-group.position.x)<1.48){const event={type:'collect',stage,lane};reset();return event;}
    if(group.position.z>player.position.z+7){const event={type:'miss',stage,lane};reset();return event;}return null;
  }
  return {group,spawn,reset,update,setPreferences(value){prefs={...prefs,...value};if(stage)draw();},getState:()=>({active,lane,z:group.position.z,stageId:stage?.id||null,kind:stage?.kind||null}),dispose(){scene.remove(group);const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();texture.dispose();}};
}
