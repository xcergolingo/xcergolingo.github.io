/** Offline sunset and broad reflection cards for the supplied sculpted car. */
export function setupRoadsterEnvironment(THREE, scene, renderer, options = {}) {
  const canvas=document.createElement('canvas');
  canvas.width=options.lowGraphics?512:1024;
  canvas.height=options.lowGraphics?256:512;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('The sunset sky needs a 2D canvas.');
  const scale=canvas.width/1024;
  const gradient=context.createLinearGradient(0,0,0,canvas.height);
  for(const [position,color] of [[0,'#3a466a'],[.22,'#806b8b'],[.38,'#ce8995'],[.47,'#f5ad87'],[.50,'#ffdab0'],[.525,'#e7aa89'],[.59,'#805d59'],[.75,'#332832'],[1,'#17151d']])gradient.addColorStop(position,color);
  context.fillStyle=gradient;context.fillRect(0,0,canvas.width,canvas.height);
  const sunX=canvas.width*.20,sunY=canvas.height*.463;
  const halo=context.createRadialGradient(sunX,sunY,2*scale,sunX,sunY,110*scale);
  for(const [position,color] of [[0,'rgba(255,250,224,.97)'],[.055,'rgba(255,239,192,.92)'],[.21,'rgba(255,218,159,.44)'],[.53,'rgba(255,192,139,.15)'],[1,'rgba(255,185,134,0)']])halo.addColorStop(position,color);
  context.fillStyle=halo;context.fillRect(0,0,canvas.width,canvas.height);
  context.beginPath();context.arc(sunX,sunY,4.3*scale,0,Math.PI*2);context.fillStyle='#fff5d7';context.fill();
  const skyTexture=new THREE.CanvasTexture(canvas);
  skyTexture.name='Roadster-Rush-procedural-sunset';
  skyTexture.mapping=THREE.EquirectangularReflectionMapping;
  skyTexture.colorSpace=THREE.SRGBColorSpace;
  skyTexture.wrapS=THREE.RepeatWrapping;
  scene.background=skyTexture;
  scene.backgroundBlurriness=0;
  scene.backgroundIntensity=1;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=options.exposure??.94;
  let target=null;
  if(!options.lowGraphics) {
    const environmentScene=new THREE.Scene();
    environmentScene.background=skyTexture;
    environmentScene.backgroundIntensity=.73;
    function reflector(width,height,position,intensity,color) {
      const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide,toneMapped:false});
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
      panel.position.set(...position);panel.lookAt(0,.45,0);environmentScene.add(panel);
    }
    reflector(9,3.9,[-.8,7,.3],1.85,0xfff5e9);
    reflector(8,.76,[-6,2.7,.5],2.6,0xdce9ff);
    reflector(7,1.65,[6.2,3.2,-.6],1.45,0xffeddd);
    reflector(5.2,1.1,[-.5,2.5,7],1.7,0xf3f7ff);
    reflector(4.7,1.55,[.8,3,-7],1.35,0xffe8c9);
    reflector(4.5,.23,[.4,4.2,1.6],2.3,0xffffff);
    const pmrem=new THREE.PMREMGenerator(renderer);
    try {target=pmrem.fromScene(environmentScene,.035,.1,80);}
    finally {
      pmrem.dispose();
      environmentScene.traverse(object=>{object.geometry?.dispose();if(Array.isArray(object.material))object.material.forEach(material=>material.dispose());else object.material?.dispose();});
    }
    target.texture.name='Roadster-Rush-sunset-softbox-PMREM';
    scene.environment=target.texture;
    scene.environmentIntensity=options.environmentIntensity??.76;
  } else scene.environment=null;
  let disposed=false;
  return {
    skyTexture,environmentTexture:target?.texture||null,
    dispose(){
      if(disposed)return;disposed=true;
      if(scene.background===skyTexture)scene.background=null;
      if(target&&scene.environment===target.texture)scene.environment=null;
      target?.dispose();skyTexture.dispose();
    }
  };
}
