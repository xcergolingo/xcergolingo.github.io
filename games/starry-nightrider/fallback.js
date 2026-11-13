/* Starry Word Rider — an original, buildless GoLingo learning adventure.
 * Deliberately uses the 2D canvas projection path so it also runs in WKWebViews
 * and browsers where WebGL 2 is unavailable. All art and interaction are live.
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('world');
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) { $('missionNote').textContent = 'This browser cannot start the painting canvas.'; return; }
  // The fallback is used by WebViews without WebGL 2. It still gets the same
  // painted paving and facades, but draws them as cheap 2D images.
  const loadPaint = url => {const img=new Image();img.src=url;return img;};
  const roadPaint=new Image();
  const wallPaint=loadPaint('./assets/stonewall-refined.webp');
  const roofPaint=loadPaint('./assets/roof-refined.webp');
  let pavingPattern=null,farHillsCache=null;
  roadPaint.onload=()=>{
    const tile=document.createElement('canvas');tile.width=tile.height=512;
    tile.getContext('2d').drawImage(roadPaint,0,0,512,512);
    pavingPattern=ctx.createPattern(tile,'repeat');
  };
  // Attach the load handler before setting src so even fast cached images
  // create the paving pattern in iPhone WKWebView.
  roadPaint.src='./assets/paving-smooth-v12.webp';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, t) => lerp(a, b, t * t * (3 - 2 * t));
  const random = n => { const x = Math.sin(n * 127.1 + 78.233) * 43758.5453123; return x - Math.floor(x); };
  const palettes = ['#dfaf63','#e9c785','#c8ad70','#a6c2a3','#e4d19a'];

  const SAMPLE = {
    es: { name: 'Spanish', locale: 'es-ES', words: [
      ['estrella','star','Las estrellas brillan esta noche.','The stars shine tonight.'],['luna','moon','La luna está hermosa.','The moon is beautiful.'],['cielo','sky','Mira el cielo azul.','Look at the blue sky.'],['camino','path','Seguimos el camino.','We follow the path.'],['bicicleta','bicycle','Voy en bicicleta.','I ride a bicycle.'],['pueblo','village','El pueblo está tranquilo.','The village is quiet.'],['luz','light','Veo una luz dorada.','I see a golden light.'],['noche','night','Es una noche tranquila.','It is a quiet night.'],['árbol','tree','Un árbol junto al camino.','A tree beside the path.'],['viento','wind','Siento el viento suave.','I feel the gentle wind.'],['sueño','dream','Es como un sueño.','It is like a dream.'],['brillar','to shine','Las luces empiezan a brillar.','The lights begin to shine.'],['viajar','to travel','Me gusta viajar.','I like to travel.'],['libertad','freedom','Siento la libertad.','I feel freedom.']] },
    ja: { name: 'Japanese', locale: 'ja-JP', words: [
      ['星','star','星がきれいです。','The stars are beautiful.'],['月','moon','月が明るいです。','The moon is bright.'],['空','sky','空を見てください。','Look at the sky.'],['道','road','道を進みます。','I go along the road.'],['自転車','bicycle','自転車に乗ります。','I ride a bicycle.'],['町','town','静かな町です。','It is a quiet town.'],['光','light','光が見えます。','I see a light.'],['夜','night','美しい夜です。','It is a beautiful night.'],['木','tree','大きな木があります。','There is a tall tree.'],['風','wind','風が吹いています。','The wind is blowing.'],['夢','dream','すてきな夢です。','It is a lovely dream.'],['花','flower','花が咲いています。','The flowers are blooming.']] },
    fr: { name: 'French', locale: 'fr-FR', words: [
      ['étoile','star','Les étoiles brillent.','The stars shine.'],['lune','moon','La lune est belle.','The moon is beautiful.'],['ciel','sky','Regarde le ciel.','Look at the sky.'],['chemin','path','Suivons le chemin.','Let us follow the path.'],['vélo','bicycle','Je fais du vélo.','I ride a bicycle.'],['village','village','Le village est calme.','The village is quiet.'],['lumière','light','Je vois une lumière.','I see a light.'],['nuit','night','Quelle belle nuit !','What a beautiful night!'],['arbre','tree','Voici un grand arbre.','Here is a tall tree.'],['vent','wind','Le vent est doux.','The wind is gentle.'],['rêve','dream','C’est un joli rêve.','It is a lovely dream.'],['voyage','journey','Le voyage commence.','The journey begins.']] },
    zh: { name: 'Chinese', locale: 'zh-CN', words: [
      ['星星','star','星星在天空中闪烁。','The stars twinkle in the sky.'],['月亮','moon','月亮很美。','The moon is beautiful.'],['天空','sky','抬头看看天空。','Look up at the sky.'],['道路','road','沿着道路向前走。','Go forward along the road.'],['自行车','bicycle','我骑自行车。','I ride a bicycle.'],['村庄','village','村庄很安静。','The village is quiet.'],['灯光','light','远处有灯光。','There is a light in the distance.'],['夜晚','night','这是美好的夜晚。','It is a lovely night.'],['树木','trees','道路旁边有树木。','There are trees beside the road.'],['微风','breeze','微风轻轻地吹。','A soft breeze is blowing.'],['梦想','dream','追逐你的梦想。','Follow your dream.'],['旅行','travel','我喜欢旅行。','I like traveling.']] },
    vi: { name: 'Vietnamese', locale: 'vi-VN', words: [
      ['ngôi sao','star','Những ngôi sao đang sáng.','The stars are shining.'],['mặt trăng','moon','Mặt trăng rất đẹp.','The moon is beautiful.'],['bầu trời','sky','Hãy nhìn bầu trời.','Look at the sky.'],['con đường','road','Đi theo con đường.','Follow the road.'],['xe đạp','bicycle','Tôi đi xe đạp.','I ride a bicycle.'],['ngôi làng','village','Ngôi làng rất yên bình.','The village is very peaceful.'],['ánh sáng','light','Tôi thấy ánh sáng.','I see a light.'],['ban đêm','night','Đêm nay thật đẹp.','Tonight is beautiful.'],['cái cây','tree','Có một cái cây lớn.','There is a big tree.'],['gió','wind','Gió thổi nhẹ.','The wind blows gently.'],['giấc mơ','dream','Một giấc mơ đẹp.','A beautiful dream.'],['hoa','flower','Hoa đang nở.','The flowers are blooming.']] },
    de: { name: 'German', locale: 'de-DE', words: [
      ['Stern','star','Die Sterne leuchten.','The stars shine.'],['Mond','moon','Der Mond ist schön.','The moon is beautiful.'],['Himmel','sky','Schau in den Himmel.','Look at the sky.'],['Weg','path','Folge dem Weg.','Follow the path.'],['Fahrrad','bicycle','Ich fahre Fahrrad.','I ride a bicycle.'],['Dorf','village','Das Dorf ist ruhig.','The village is quiet.'],['Licht','light','Ich sehe ein Licht.','I see a light.'],['Nacht','night','Es ist eine schöne Nacht.','It is a beautiful night.'],['Baum','tree','Ein Baum steht am Weg.','A tree stands beside the path.'],['Wind','wind','Der Wind ist sanft.','The wind is gentle.'],['Traum','dream','Das ist ein schöner Traum.','It is a beautiful dream.'],['Reise','journey','Die Reise beginnt.','The journey begins.']] }
  };
  const nameFor = code => SAMPLE[code]?.name || new Intl.DisplayNames(['en'], { type: 'language' }).of((code || 'es').split('-')[0]) || code;
  const getLocale = code => SAMPLE[code]?.locale || code || 'es-ES';
  let lesson = null;
  let importedLesson = null;
  let W = 0, H = 0, DPR = 1;
  let lastTime = performance.now();
  let rideAudio = null, voiceNotice = '', currentUtterance = null, sharedWordAudio = null;
  let utteranceTimer = null, voiceToken = 0, playingAudio = null;
  let particles = [], orbs = [], sceneObjects = [], groundMarks = [], screenOrbs = [];
  let orbitIndex = 0, nextOrbZ = 0, lastHudUpdate = 0, toastTimer = null, jumpToastTimer = null;
  const keys = { left: false, right: false, forward: false, brake: false, joyX: 0, joyY: 0 };
  let resetSteering = () => { keys.left=keys.right=keys.forward=keys.brake=false;keys.joyX=keys.joyY=0; };

  const state = {
    started: false, paused: false, z: 0, lane: 0, lean: 0, speed: 12,
    jumpY: 0, jumpVel: 0, jumpCount: 0, trickUntil: 0, trickStart: 0,
    total: 0, delivered: 0, bag: [], discovered: [], stage: 0,
    current: null, autoRide: true, repeat: true, audioOn: true,fxOn:true,speechGap:2200,
    showCard: true, showMeaning: true, moment: 0
  };
  try{
    state.audioOn=localStorage.getItem('golingoStarryVoice')!=='off';
    state.fxOn=localStorage.getItem('golingoStarryAmbience')!=='off';
    state.speechGap=Number(localStorage.getItem('golingoStarrySpeechGap')||2200);
  }catch{}
  try { sharedWordAudio = new Audio(); sharedWordAudio.preload = 'auto'; } catch {}
  // Load the sound engine BEFORE accepting Play, so the eventual click calls
  // AudioContext.resume and speech directly within its trusted gesture.
  for (const id of ['startBtn','skipIntroBtn']) if ($(id)) $(id).disabled = true;
  const audioReady = import('./audio-engine.js?v=11').then(({createRideAudio}) => {
    rideAudio = createRideAudio({onStatus: updateSoundUi});
    setAmbientVolume();
  }).catch(() => {
    voiceNotice = 'Game sound is unavailable here. Word pronunciation can still be tested below.';
    updateSoundUi();
  });

  function normalizeLesson(value) {
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { try { value = JSON.parse(decodeURIComponent(value)); } catch { return null; } }
    }
    if (!value || typeof value !== 'object') return null;
    const source = value.data?.words ? value.data : value.payload?.words ? value.payload : value;
    let words = Array.isArray(source.words) ? source.words : Array.isArray(source.sentences) ? source.sentences : null;
    if (!words || !words.length) return null;
    words = words.slice(0, 2500).map((entry, i) => {
      if (typeof entry === 'string') return { id: String(i), word: entry.slice(0, 100), translation: '' };
      if (!entry || typeof entry !== 'object') return null;
      return {
        id: String(entry.id ?? i),
        word: String(entry.word ?? entry.text ?? entry.sentence ?? '').slice(0, 130),
        translation: String(entry.translation ?? entry.meaning ?? entry.sentenceTranslation ?? '').slice(0, 160),
        sentence: String(entry.sentence ?? '').slice(0, 220),
        sentenceTranslation: String(entry.sentenceTranslation ?? '').slice(0, 220),
        audioURL: typeof entry.audioURL === 'string' ? entry.audioURL : typeof entry.audioUrl === 'string' ? entry.audioUrl : ''
      };
    }).filter(entry => entry?.word);
    if (!words.length) return null;
    return { primaryLanguage: String(source.primaryLanguage ?? 'en'), learningLanguage: String(source.learningLanguage ?? 'es'), words, imported: true };
  }

  function demoLesson(code) {
    const pack = SAMPLE[code] || SAMPLE.es;
    return { primaryLanguage: 'en', learningLanguage: code, words: pack.words.map((v,i) => ({ id:String(i+1),word:v[0],translation:v[1],sentence:v[2],sentenceTranslation:v[3] })), imported:false };
  }

  function setLesson(value, isExternal = false) {
    const normalized = normalizeLesson(value);
    if (!normalized) return false;
    importedLesson = isExternal ? normalized : importedLesson;
    lesson = normalized;
    if (isExternal) {
      const sel = $('languageSelect');
      if ([...sel.options].some(o => o.value === lesson.learningLanguage)) sel.value = lesson.learningLanguage;
      else {
        const option = document.createElement('option'); option.value = lesson.learningLanguage;
        option.textContent = `${nameFor(lesson.learningLanguage)} · GoLingo import`;
        sel.appendChild(option); sel.value = lesson.learningLanguage;
      }
    }
    resetRide(true);
    const label = isExternal ? `${lesson.words.length} GoLingo words loaded. Ride into the golden lights.` : 'Follow the golden lights. Every star is a new word.';
    $('missionNote').querySelector('span:last-child').textContent = label;
    $('missionNote').classList.remove('faded');
    return true;
  }

  function loadInitialLesson() {
    let parsed = null;
    const params = new URLSearchParams(location.search);
    for (const key of ['data','golingo','payload','wordData','words']) {
      if (params.has(key)) { parsed = normalizeLesson(params.get(key)); if (parsed) break; }
    }
    if (!parsed && location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      for (const key of ['data','golingo','payload']) { if (hashParams.has(key)) { parsed = normalizeLesson(hashParams.get(key)); if(parsed) break; } }
    }
    if (!parsed && window.name && window.name.length < 2_000_000) parsed = normalizeLesson(window.name);
    if (parsed) setLesson(parsed, true);
    else { lesson = demoLesson('es'); resetRide(true); }
  }

  // GoLingo can send large lessons by postMessage or WKWebView evaluateJavaScript,
  // rather than placing potentially megabytes of JSON into a URL.
  const receiver = value => setLesson(value, true);
  window.loadGoLingoWords = receiver;
  window.receiveGoLingoData = receiver;
  window.receiveGoLingoWords = receiver;
  window.addEventListener('message', event => {
    const incoming = event.data;
    if (!incoming) return;
    if (typeof incoming === 'object') {
      const type = String(incoming.type || '').toLowerCase();
      if (['golingowords','golingodata','setwords','golingo:words','golingo_game_data','worddata'].includes(type)) receiver(incoming.payload ?? incoming.data ?? (incoming.words ? incoming : null));
      else if (Array.isArray(incoming.words) && incoming.learningLanguage) receiver(incoming);
    }
  });

  function roadX(z) { return Math.sin(z * 0.011) * 9.2 + Math.sin(z * 0.025) * 3.1; }
  const roadWidth = 8.9;
  const locationX = (z, side, extra = 0) => roadX(z) + side * (roadWidth * .68 + extra);

  function buildWorld() {
    sceneObjects = []; groundMarks = [];
    for (let i = 0, z = 18; z < 5400; i++, z += 16 + random(i+30)*11) {
      for (const side of [-1,1]) {
        const n = i*13 + (side+1)*103;
        const chance = random(n);
        const kind = chance < .23 ? 'house' : chance < .59 ? 'cypress' : chance < .78 ? 'tree' : 'flowers';
        const extra = kind === 'house' ? 8 + random(n+1)*19 : 3 + random(n+2)*17;
        sceneObjects.push({ z: z + random(n+4)*7, x: locationX(z,side,extra), kind, variation:random(n+7), side });
        if (random(n+6)>.57) sceneObjects.push({z:z+9, x:locationX(z+9,side,extra*.47),kind:'flowers',variation:random(n+12),side});
      }
    }
    for (let i=0;i<1800;i++) {
      const z = random(i*2+13)*5400, side = random(i*4+85)<.5?-1:1;
      const off = roadWidth*.6 + 2 + random(i*7+19)*35;
      groundMarks.push({z,x:locationX(z,side,off),seed:i,color:palettes[i%palettes.length]});
    }
  }

  function resetRide(keepLesson = true) {
    cancelSpeech();
    if (!keepLesson || !lesson) lesson = demoLesson('es');
    state.z = 0; state.lane = 0; state.lean = 0; state.speed = 12;
    state.jumpY = 0; state.jumpVel=0;state.jumpCount=0;state.stage=0;
    state.total=0;state.delivered=0;state.bag=[];state.discovered=[];
    state.current=null;state.trickUntil=0;state.trickStart=0;
    particles=[];orbs=[];orbitIndex=0;nextOrbZ=30;
    for(let i=0;i<16;i++) orbs.push(makeOrb());
    updateHud(); updateWordCard();
    $('bookDot').classList.remove('show');
  }

  function makeOrb() {
    const i = orbitIndex++;
    const z = nextOrbZ;
    nextOrbZ += 19.5 + random(i*7+4)*8;
    const offset = [-2.05, 1.95, 0, -1.7, 2.0, .6, -1.9, 0][i%8];
    return { id:i, index:i%lesson.words.length, z, offset, phase:random(i+3)*TAU, collected:false };
  }

  function resize() {
    W = Math.max(1, window.innerWidth); H=Math.max(1,window.innerHeight);
    // Twice device pixel ratio was costing over a million filled pixels per
    // frame on an iPhone despite this mode's deliberately painterly detail.
    DPR = Math.min(window.devicePixelRatio || 1, W<730?1.2:1.55);
    canvas.width = Math.floor(W*DPR); canvas.height=Math.floor(H*DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    farHillsCache=null;
  }
  window.addEventListener('resize', resize, { passive:true });

  function project(x,z) {
    const d = z - state.z;
    if (d < -.5 || d > 270) return null;
    const dz = Math.max(0,d);
    const scale = W*1.04/(dz+24);
    const camX = roadX(state.z) + state.lane*.63;
    return {x: W*.5 + (x-camX)*scale, y:H*(.553+.555/(1+dz/24)), s:scale, d:dz};
  }

  function roundedRect(x,y,w,h,r) {
    if (w<=0||h<=0) return;
    r=Math.min(r,w*.5,h*.5);
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }

  function paintFarHills(time) {
    if(farHillsCache){ctx.drawImage(farHillsCache,0,0,W,H);return;}
    const baseline=H*.609;
    ctx.save();
    const g=ctx.createLinearGradient(0,baseline,0,H);
    g.addColorStop(0,'#31526b');g.addColorStop(.25,'#1a415a');g.addColorStop(1,'#092844');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,H);
    for(let x=0;x<=W+15;x+=15) {
      const r=x/W;
      const y=baseline+ Math.sin(r*15.1+1)*H*.022 + Math.sin(r*35-1)*H*.01 - H*.015;
      ctx.lineTo(x,y);
    }
    ctx.lineTo(W,H);ctx.closePath();ctx.fill();
    for(let k=0;k<4;k++) {
      ctx.strokeStyle=['#426a75','#53726a','#204b62','#6b8c8b'][k];
      ctx.globalAlpha=.20;ctx.lineWidth=1.5+k*.65;
      ctx.beginPath();
      for(let x=0;x<=W+7;x+=7) {
        const r=x/W, y=baseline + H*(.024+.031*k)+ Math.sin(r*(14+k*2)+k)*H*.012;
        if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha=.65;
    for(let i=0;i<57;i++) {
      const x=random(i*29+12)*W, y=baseline-H*.012+random(i+22)*H*.09;
      ctx.fillStyle=palettes[i%palettes.length];ctx.fillRect(x,y,1.5+random(i+13)*3,.8+random(i+11)*2);
    }
    ctx.restore();
    // Small distant rooftops keep the village anchored beneath the painted sky.
    ctx.save();ctx.globalAlpha=.88;
    for(let i=0;i<27;i++){
      const x=(i/26)*W + Math.sin(i*33)*9;
      const y=baseline+Math.sin(i*1.9)*H*.015;
      const ww=8+random(i+1)*17, hh=8+random(i+5)*14;
      ctx.fillStyle=i%3===0?'#142d46':'#10243f';ctx.fillRect(x,y-hh,ww,hh);
      ctx.fillStyle=i%3===0?'#213a59':'#263e53';ctx.beginPath();ctx.moveTo(x-3,y-hh);ctx.lineTo(x+ww*.48,y-hh-7);ctx.lineTo(x+ww+3,y-hh);ctx.fill();
      ctx.fillStyle='#f6c97e';ctx.globalAlpha=.55+random(i+34)*.36;ctx.fillRect(x+ww*.5,y-hh*.6,2.8,3.5);
    }
    ctx.restore();
    // Hills and the distant village do not move with the rider. Rasterize
    // these hundreds of vector strokes once per resize, then blit one image.
    farHillsCache=document.createElement('canvas');
    farHillsCache.width=canvas.width;farHillsCache.height=canvas.height;
    farHillsCache.getContext('2d').drawImage(canvas,0,0);
  }

  function paintBrushStrokes(time) {
    ctx.save();
    for(const mark of groundMarks) {
      if(mark.z < state.z-2 || mark.z > state.z+155) continue;
      const p=project(mark.x,mark.z);if(!p || p.x< -40||p.x>W+40)continue;
      const k=clamp(p.s*.11,.3,2.8);
      ctx.globalAlpha=clamp(.3-p.d/520,.06,.33);
      ctx.strokeStyle=mark.color;ctx.lineWidth=clamp(p.s*.045,1,4);
      const ang=(random(mark.seed+17)-.5)*.6;
      ctx.beginPath();ctx.moveTo(p.x-k*3,p.y);ctx.quadraticCurveTo(p.x,p.y-1.5*k,p.x+k*(4+Math.cos(ang)),p.y-2*k);ctx.stroke();
    }
    ctx.restore();
  }

  function paintRoad(time) {
    ctx.save();
    const left=[],right=[];
    for(let d=260;d>=0;d-=4){
      const z=state.z+d,p=project(roadX(z),z);if(!p)continue;
      const half=roadWidth*.5*p.s;
      left.push([p.x-half,p.y]);right.push([p.x+half,p.y]);
    }
    if(left.length>1){
      ctx.beginPath();ctx.moveTo(...left[0]);
      for(let i=1;i<left.length;i++)ctx.lineTo(...left[i]);
      for(let i=right.length-1;i>=0;i--)ctx.lineTo(...right[i]);
      ctx.closePath();ctx.fillStyle='#9b769e';ctx.fill();
      // One masked tiled image replaces 87 individual asphalt polygons plus
      // ninety flecks. Its very fine brushwork resembles the filmed pink road.
      if(pavingPattern){
        ctx.save();ctx.clip();ctx.globalAlpha=.87;
        ctx.translate(0,(state.z*7)%512);
        ctx.fillStyle=pavingPattern;ctx.fillRect(-512,-512,W+1024,H+1024);
        ctx.restore();
      }
      ctx.save();ctx.clip();
      const shade=ctx.createLinearGradient(0,H*.56,0,H);
      shade.addColorStop(0,'rgba(13,26,63,.56)');
      shade.addColorStop(.44,'rgba(82,45,111,.08)');
      shade.addColorStop(1,'rgba(31,25,66,.17)');
      ctx.fillStyle=shade;ctx.fillRect(0,H*.52,W,H*.65);ctx.restore();
      for(const edge of [left,right]){
        ctx.beginPath();ctx.moveTo(...edge[0]);
        for(let i=1;i<edge.length;i++)ctx.lineTo(...edge[i]);
        ctx.strokeStyle='#cba4b1';ctx.lineWidth=clamp(W*.003,1.5,3.4);ctx.globalAlpha=.78;ctx.stroke();
      }
    }
    ctx.restore();
  }

  function paintCypress(p,obj,time) {
    const h=clamp(p.s*(7.7+obj.variation*6),8,H*.85),w=h*.23;
    const x=p.x,y=p.y;
    ctx.save();ctx.shadowColor='#001925';ctx.shadowBlur=14;
    ctx.fillStyle='#071f2d';ctx.beginPath();ctx.moveTo(x,y+3);
    ctx.bezierCurveTo(x-w*.57,y-h*.19,x-w*.36,y-h*.54,x-w*.17,y-h*.74);
    ctx.quadraticCurveTo(x-w*.26,y-h*.96,x,y-h);ctx.quadraticCurveTo(x+w*.19,y-h*.95,x+w*.11,y-h*.77);
    ctx.bezierCurveTo(x+w*.46,y-h*.55,x+w*.46,y-h*.27,x+w*.58,y+3);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
    for(let i=0;i<13;i++){
      const f=i/13, py=y-h*f;
      ctx.strokeStyle=i%3===0?'#4b6a61':'#23534f';ctx.lineWidth=clamp(w*.11,1,5);ctx.globalAlpha=.44;
      ctx.beginPath();ctx.moveTo(x+(Math.sin(i*2.34)*w*.35),py);ctx.quadraticCurveTo(x+w*(.22+Math.sin(i)*.17),py-h*.038,x+w*.1,py-h*.055);ctx.stroke();
    }
    ctx.restore();
  }

  function paintTree(p,obj,time) {
    const h=clamp(p.s*(4+obj.variation*3),5,H*.34),x=p.x,y=p.y;
    ctx.save();ctx.strokeStyle='#182b38';ctx.lineCap='round';ctx.lineWidth=clamp(h*.09,1,12);
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-1,y-h*.55);ctx.stroke();
    for(let i=0;i<5;i++) {
      const xx=x+Math.sin(i*2.3+obj.variation)*h*.22,yy=y-h*(.62+i*.062);
      ctx.fillStyle=['#183e48','#2d5d5c','#28485a','#44676a','#284d54'][i];ctx.globalAlpha=.91;
      ctx.beginPath();ctx.ellipse(xx,yy,h*(.22+i*.008),h*.15,Math.sin(i+obj.variation)*.35,0,TAU);ctx.fill();
      ctx.globalAlpha=.22;ctx.fillStyle='#e0b86f';ctx.beginPath();ctx.ellipse(xx-1,yy-h*.055,h*.15,h*.034,-.5,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  function paintHouse(p,obj,time) {
    const s=p.s,ww=clamp(s*(3.3+obj.variation*1.8),5,W*.19),hh=ww*.91;
    const x=p.x,y=p.y;
    ctx.save();ctx.fillStyle='rgba(2,15,28,.27)';ctx.beginPath();ctx.ellipse(x+ww*.05,y,ww*.7,ww*.11,0,0,TAU);ctx.fill();
    const face=obj.variation>.55?'#aaa3b6':'#aaaeb8';
    ctx.fillStyle=face;ctx.fillRect(x-ww*.5,y-hh,ww,hh);
    if(wallPaint.complete&&wallPaint.naturalWidth){
      ctx.globalAlpha=.91;ctx.drawImage(wallPaint,x-ww*.5,y-hh,ww,hh);ctx.globalAlpha=1;
      ctx.fillStyle=obj.variation>.55?'rgba(23,43,87,.21)':'rgba(24,37,73,.10)';
      ctx.fillRect(x-ww*.5,y-hh,ww,hh);
    }
    ctx.fillStyle='#923e43';ctx.beginPath();ctx.moveTo(x-ww*.6,y-hh);ctx.lineTo(x,y-hh-ww*.47);ctx.lineTo(x+ww*.6,y-hh);ctx.closePath();ctx.fill();
    if(roofPaint.complete&&roofPaint.naturalWidth){
      ctx.save();ctx.clip();ctx.globalAlpha=.94;
      ctx.drawImage(roofPaint,x-ww*.6,y-hh-ww*.47,ww*1.2,ww*.53);ctx.restore();
    }
    ctx.strokeStyle='#47354b';ctx.lineWidth=Math.max(.8,s*.018);ctx.stroke();
    if(obj.variation>.34){
      ctx.strokeStyle='rgba(42,46,65,.88)';ctx.lineWidth=Math.max(1.3,ww*.025);
      ctx.beginPath();ctx.moveTo(x-ww*.48,y-hh*.5);ctx.lineTo(x+ww*.48,y-hh*.5);
      ctx.moveTo(x-ww*.45,y-hh);ctx.lineTo(x-ww*.45,y);ctx.moveTo(x+ww*.45,y-hh);ctx.lineTo(x+ww*.45,y);ctx.stroke();
    }
    ctx.fillStyle='#db9f52';
    const aw=ww*.14,ah=hh*.22;
    for(let j=0;j<2;j++)for(let k=0;k<2;k++){
      const wx=x-ww*.29+j*ww*.45,wy=y-hh*.71+k*hh*.32;
      ctx.shadowColor='#ffd37b';ctx.shadowBlur=clamp(s*.45,2,19);ctx.fillRect(wx,wy,aw,ah);ctx.shadowBlur=0;
      ctx.strokeStyle='#654e4b';ctx.lineWidth=Math.max(.7,ww*.024);ctx.strokeRect(wx,wy,aw,ah);
    }
    ctx.fillStyle='#151f35';ctx.fillRect(x-ww*.09,y-hh*.36,ww*.2,hh*.36);
    for(let i=0;i<5;i++){
      ctx.globalAlpha=.35;ctx.strokeStyle=i%2?'#e2b36f':'#92b3a0';ctx.lineWidth=Math.max(.7,ww*.023);
      const by=y-hh*.15-i*hh*.17;
      ctx.beginPath();ctx.moveTo(x-ww*.49,by);ctx.lineTo(x-ww*.17,by+ww*.015);ctx.stroke();
    }
    ctx.restore();
  }

  function paintChurch(p,time) {
    const scale=p.s,hh=clamp(scale*20,15,H*1.2),ww=hh*.45,x=p.x,y=p.y;
    ctx.save();ctx.globalAlpha=clamp(1-p.d/340,.18,1);
    ctx.fillStyle='#213850';ctx.fillRect(x-ww*.5,y-hh*.43,ww,hh*.43);
    ctx.fillStyle='#2d4b61';ctx.fillRect(x-ww*.19,y-hh*.78,ww*.38,hh*.78);
    ctx.fillStyle='#1a2d48';ctx.beginPath();ctx.moveTo(x-ww*.25,y-hh*.78);ctx.lineTo(x,y-hh*1.15);ctx.lineTo(x+ww*.25,y-hh*.78);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f3c47c';ctx.shadowColor='#f6d58f';ctx.shadowBlur=16;
    ctx.fillRect(x-ww*.075,y-hh*.62,ww*.15,hh*.135);
    for(let j=-1;j<=1;j++)ctx.fillRect(x+j*ww*.25-ww*.035,y-hh*.28,ww*.07,hh*.11);
    ctx.restore();
  }

  function paintFlowers(p,obj,time) {
    const s=p.s,x=p.x,y=p.y;
    ctx.save();
    for(let i=0;i<8;i++){
      const d=(random(i+obj.z*3)-.5)*s*1.8;
      const u=(random(i+obj.x*3)-.5)*s*.5;
      const r=clamp(s*.055,1,4.5);
      ctx.globalAlpha=clamp(1-p.d/220,.1,.9);
      ctx.fillStyle=i%3===0?'#ecc777':i%3===1?'#c1a6c8':'#87afab';
      ctx.beginPath();ctx.arc(x+d,y+u,r,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  function paintObjects(time) {
    const visible=[];
    for(const obj of sceneObjects) if(obj.z>=state.z+2&&obj.z<state.z+220)visible.push(obj);
    // Far-to-near painter's order creates proper overlap with the rider.
    visible.sort((a,b)=>b.z-a.z);
    for(const obj of visible){
      const p=project(obj.x,obj.z);if(!p||p.x< -W*.23||p.x>W*1.23)continue;
      if(obj.kind==='cypress')paintCypress(p,obj,time);
      else if(obj.kind==='house')paintHouse(p,obj,time);
      else if(obj.kind==='tree')paintTree(p,obj,time);
      else paintFlowers(p,obj,time);
    }
    const chapelZ=(state.stage+1)*240-7;
    const chapelP=project(roadX(chapelZ)+roadWidth*.95,chapelZ);
    if(chapelP)paintChurch(chapelP,time);
  }

  function paintOrbs(time) {
    screenOrbs=[];
    const visible=orbs.filter(o=>o.z>state.z-1&&o.z<state.z+190).sort((a,b)=>b.z-a.z);
    for(const orb of visible){
      const word=lesson.words[orb.index],wx=roadX(orb.z)+orb.offset;
      const p=project(wx,orb.z);if(!p)continue;
      const radius=clamp(p.s*.55,5,26);
      const x=p.x, y=p.y - 2.15*p.s + Math.sin(time*.002+orb.phase)*radius*.18;
      if(x < -120 || x>W+120)continue;
      const glow=ctx.createRadialGradient(x,y,1,x,y,radius*3.25);
      glow.addColorStop(0,'rgba(255,250,203,.95)');glow.addColorStop(.24,'rgba(255,210,109,.72)');
      glow.addColorStop(.53,'rgba(255,193,84,.24)');glow.addColorStop(1,'rgba(255,194,90,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,radius*3.25,0,TAU);ctx.fill();
      ctx.save();ctx.translate(x,y);ctx.rotate(time*.00026+orb.phase);
      ctx.strokeStyle='#fff2b9';ctx.lineWidth=clamp(radius*.085,1.2,2.8);ctx.globalAlpha=.9;
      ctx.beginPath();ctx.ellipse(0,0,radius*.94,radius*.94,0,.15,Math.PI*1.6);ctx.stroke();
      ctx.rotate(-time*.00051);ctx.globalAlpha=.65;
      ctx.beginPath();ctx.ellipse(0,0,radius*1.3,radius*.65,.65,0,TAU);ctx.stroke();
      for(let k=0;k<4;k++){
        ctx.rotate(TAU/4);ctx.fillStyle='#fff0b6';ctx.beginPath();ctx.moveTo(0,-radius*1.12);ctx.lineTo(radius*.12,-radius*1.43);ctx.lineTo(0,-radius*1.68);ctx.lineTo(-radius*.12,-radius*1.43);ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle='#fffbdc';ctx.beginPath();ctx.arc(x,y,radius*.47,0,TAU);ctx.fill();
      // In-world labels remain small enough to preserve the open road view.
      if(p.d<125) {
        ctx.save();
        const size=clamp(10+p.s*.32,11,19), text=word.word.length>26?word.word.slice(0,25)+'…':word.word;
        ctx.font=`${size}px Georgia, serif`;
        const textWidth=ctx.measureText(text).width;
        const labelW=textWidth+22,labelH=size+13,ly=y-radius*2.3-labelH;
        roundedRect(x-labelW*.5,ly,labelW,labelH,9);
        ctx.fillStyle='rgba(8,25,51,.79)';ctx.fill();ctx.strokeStyle='rgba(255,225,151,.57)';ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle='#fff5d6';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,ly+labelH*.52);
        ctx.restore();
      }
      screenOrbs.push({x,y,r:radius*2.7,word});
    }
  }

  function paintWind(time) {
    ctx.save();
    for(let i=0;i<32;i++) {
      const n=i*13.3, phase=random(i+18)*TAU;
      const x=((random(n+9)*W+time*.018*(.2+random(i+30)))%(W+140))-70;
      const y=H*(.16+random(i*2+9)*.65);
      const alpha=(.12+.23*(.5+.5*Math.sin(time*.002+phase)))*(state.started?.95:.63);
      ctx.globalAlpha=alpha;ctx.strokeStyle=i%4===0?'#ffe8a8':'#cce5d7';ctx.lineWidth=i%3===0?2:1;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+9,y-7,x+24+random(i)*25,y-5);ctx.stroke();
    }
    ctx.restore();
  }

  function paintBike(time) {
    const unit=clamp(Math.min(W/1000,H/690)*1.2,.48,1.3);
    const x=W*.5+state.lane*W*.0165;
    const groundY=H*.875;
    const hop=state.jumpY*unit*25;
    ctx.save();ctx.globalAlpha=clamp(.44-state.jumpY*.038,.12,.44);ctx.fillStyle='#071422';
    ctx.beginPath();ctx.ellipse(x,groundY+35*unit,56*unit*(1+state.jumpY*.09),14*unit*(1+state.jumpY*.05),0,0,TAU);ctx.fill();ctx.restore();
    ctx.save();ctx.translate(x,groundY-hop);ctx.scale(unit,unit);
    const trickProgress=state.trickUntil>time ? clamp((time-state.trickStart)/(state.trickUntil-state.trickStart),0,1):0;
    ctx.rotate(-state.lean*.075+ (trickProgress ? Math.sin(trickProgress*Math.PI)*Math.PI*2 : 0));
    const pedalAngle=time*.009*(state.speed/12);
    const tire=(cx,cy,rx,ry,light)=>{
      ctx.save();ctx.strokeStyle='#081421';ctx.lineWidth=11;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,TAU);ctx.stroke();
      ctx.strokeStyle=light;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(cx,cy,rx-2,ry-2,0,0,TAU);ctx.stroke();
      ctx.strokeStyle='rgba(217,227,206,.52)';ctx.lineWidth=.85;
      for(let j=0;j<12;j++){const t=j*TAU/12+pedalAngle*.2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+rx*.88*Math.cos(t),cy+ry*.88*Math.sin(t));ctx.stroke();}
      ctx.restore();
    };
    tire(1,36,17,43,'#9aa6a5');
    tire(1,-6,12,31,'#aeb3a3');
    // Brass bicycle fork, frame and swept handlebars.
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='#b68750';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-1,36);ctx.lineTo(-20,-15);ctx.lineTo(0,5);ctx.lineTo(-1,36);ctx.moveTo(0,5);ctx.lineTo(7,-7);ctx.moveTo(7,-7);ctx.lineTo(1,-21);ctx.stroke();
    ctx.strokeStyle='#f1cd8d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-1,35);ctx.lineTo(-20,-15);ctx.lineTo(0,5);ctx.stroke();
    ctx.strokeStyle='#172c37';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-34,-25);ctx.quadraticCurveTo(0,-34,34,-25);ctx.stroke();
    ctx.restore();
    // Boots and pedalling legs move independently.
    for(let j=0;j<2;j++){
      const side=j===0?-1:1, phase=pedalAngle+j*Math.PI;
      const kneeX=side*10+Math.sin(phase)*7,kneeY=15+Math.cos(phase)*14;
      const footX=side*14+Math.sin(phase)*13,footY=45+Math.cos(phase)*14;
      ctx.strokeStyle='#263746';ctx.lineWidth=15;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(side*10,-17);ctx.lineTo(kneeX,kneeY);ctx.lineTo(footX,footY);ctx.stroke();
      ctx.strokeStyle='#121e30';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(footX-3,footY+1);ctx.lineTo(footX+side*6,footY+6);ctx.stroke();
    }
    // Match the reference cyclist: bright cobalt jacket, brown satchel,
    // yellow straw hat and a red scarf instead of the old brown coat.
    const coat=ctx.createLinearGradient(-30,-100,35,10);coat.addColorStop(0,'#4a84df');coat.addColorStop(.48,'#2964c4');coat.addColorStop(1,'#163a82');
    ctx.fillStyle=coat;ctx.beginPath();ctx.moveTo(-25,-88);ctx.quadraticCurveTo(-32,-66,-27,-32);ctx.lineTo(-21,6);ctx.quadraticCurveTo(0,16,23,4);ctx.lineTo(27,-42);ctx.quadraticCurveTo(35,-70,22,-88);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(183,220,252,.26)';ctx.beginPath();ctx.moveTo(-23,-82);ctx.quadraticCurveTo(-15,-76,-13,-62);ctx.lineTo(-18,-4);ctx.lineTo(-23,-7);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#8fbbe6';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(3,-79);ctx.quadraticCurveTo(-1,-34,5,5);ctx.stroke();
    ctx.fillStyle='#563c31';roundedRect(14,-57,24,34,5);ctx.fill();
    ctx.fillStyle='#82583e';ctx.fillRect(16,-56,20,10);
    ctx.strokeStyle='#c69869';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(17,-45);ctx.lineTo(10,-83);ctx.stroke();
    // Arms brace on the bars.
    ctx.strokeStyle='#2a58b1';ctx.lineCap='round';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(-20,-77);ctx.lineTo(-30,-42);ctx.lineTo(-31,-27);ctx.moveTo(21,-77);ctx.lineTo(31,-43);ctx.lineTo(32,-27);ctx.stroke();
    ctx.fillStyle='#e0b88c';for(const side of [-1,1]){ctx.beginPath();ctx.arc(side*31,-26,5.5,0,TAU);ctx.fill();}
    // Warm scarf streaming in the breeze.
    ctx.fillStyle='#cc3e47';ctx.beginPath();ctx.moveTo(13,-80);ctx.quadraticCurveTo(35,-75,45+Math.sin(time*.006)*9,-93);ctx.quadraticCurveTo(27,-88,14,-92);ctx.closePath();ctx.fill();
    // Portrait-from-behind head, hair, and a jaunty brimmed hat.
    ctx.fillStyle='#c18e6b';ctx.beginPath();ctx.ellipse(0,-105,17,20,0,0,TAU);ctx.fill();
    ctx.fillStyle='#2a2835';ctx.beginPath();ctx.ellipse(0,-111,18,14,0,Math.PI,TAU);ctx.lineTo(15,-97);ctx.quadraticCurveTo(1,-94,-13,-100);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e5bf65';ctx.beginPath();ctx.ellipse(0,-126,24,5,0,0,TAU);ctx.fill();
    ctx.fillStyle='#d3a451';roundedRect(-14,-149,29,24,8);ctx.fill();
    ctx.strokeStyle='#936f3a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-14,-132);ctx.lineTo(14,-132);ctx.stroke();
    // Pointillist highlights make the rider feel part of the canvas.
    ctx.globalAlpha=.52;ctx.strokeStyle='#f4d29a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-20,-78);ctx.lineTo(-24,-57);ctx.moveTo(-17,-3);ctx.lineTo(-8,2);ctx.moveTo(12,-145);ctx.lineTo(15,-142);ctx.stroke();
    ctx.restore();
  }

  function createBurst(x,y,count=22) {
    for(let i=0;i<count;i++){
      const a=random(i*17+state.z)*TAU, force=1.2+random(i*23+state.z)*4;
      particles.push({x,y,vx:Math.cos(a)*force*26,vy:Math.sin(a)*force*24-28,life:.6+random(i+state.z)*.8,age:0,rad:2+random(i*51+state.z)*4,color:palettes[i%palettes.length]});
    }
  }
  function paintParticles(dt) {
    ctx.save();
    for(const p of particles){
      p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=35*dt;
      ctx.globalAlpha=clamp(1-p.age/p.life,0,1);ctx.fillStyle=p.color;
      ctx.beginPath();ctx.arc(p.x,p.y,p.rad*(1-p.age/p.life*.6),0,TAU);ctx.fill();
    }
    ctx.restore();particles=particles.filter(p=>p.age<p.life);
  }

  function draw(time,dt) {
    ctx.clearRect(0,0,W,H);
    paintFarHills(time);
    paintBrushStrokes(time);
    paintRoad(time);
    paintObjects(time);
    paintOrbs(time);
    paintWind(time);
    paintBike(time);
    paintParticles(dt);
  }

  function updateHud() {
    $('wordCount').textContent=String(state.total);
    $('deliveredCount').textContent=String(state.delivered);
    const remaining=Math.max(0,(state.stage+1)*240-state.z);
    $('chapelDistance').textContent=`${Math.ceil(remaining)} m`;
    $('meterProgress').style.width=`${clamp(100-remaining/240*100,0,100)}%`;
    $('bookWordCount').textContent=String(state.discovered.length);
    $('bookDeliveredCount').textContent=String(state.delivered);
    $('pedalText').textContent=state.autoRide?'AUTO RIDE':'PEDAL';
    $('pedalBtn').classList.toggle('is-off',!state.autoRide);
    $('hideBtn').classList.toggle('is-off',!state.showCard);
    $('soundBtn').classList.toggle('is-off',!state.audioOn);
    $('soundBtn').setAttribute('aria-label',state.audioOn?'Turn off word pronunciation':'Turn on word pronunciation');
    $('voiceState').textContent=state.audioOn?'VOICE ON':'VOICE OFF';
    $('voiceIcon').textContent=state.audioOn?'♫':'♪';
    updateSoundUi();
  }

  function updateWordCard() {
    const item=state.current;
    $('currentLanguage').textContent=nameFor(lesson.learningLanguage).toUpperCase();
    $('currentWord').textContent=item?item.word:'Follow the stars';
    $('currentTranslation').textContent=state.showMeaning?(item?item.translation:'Ride into a glowing word to begin.'):'••••••';
    $('wordExample').textContent=item?(item.sentence || 'Listen, ride, and remember.').slice(0,75):'Words repeat until you collect the next one.';
    $('translationBtn').textContent=state.showMeaning?'Hide meaning':'Show meaning';
    $('wordCard').classList.toggle('hidden-word',!state.showCard);
  }

  function showJumpText(text) {
    clearTimeout(jumpToastTimer);$('jumpToast').textContent=text;$('jumpToast').classList.add('show');
    jumpToastTimer=setTimeout(()=>$('jumpToast').classList.remove('show'),920);
  }
  function showDelivery(count) {
    clearTimeout(toastTimer);
    $('deliveryToast').innerHTML=`<small>✦ &nbsp; THE VILLAGE STEEPLE &nbsp; ✦</small><strong>${count} words delivered</strong><small>A beautiful night for learning. Keep riding →</small>`;
    $('deliveryToast').classList.add('show');
    toastTimer=setTimeout(()=>$('deliveryToast').classList.remove('show'),3700);
  }

  function collectOrb(orb,time) {
    const item=lesson.words[orb.index];
    state.total++;state.current=item;state.bag.push(item);
    state.discovered.push(item);
    const p=project(roadX(orb.z)+orb.offset,orb.z);
    if(p)createBurst(p.x,p.y-p.s*2.2,27);
    Object.assign(orb,makeOrb());
    $('bookDot').classList.add('show');
    $('missionNote').classList.add('faded');
    updateHud();updateWordCard();playPickupChime();startWordLoop(item);
    try { window.parent?.postMessage({type:'GOLINGO_GAME_EVENT',event:'wordCollected',word:item.word,translation:item.translation,id:item.id,game:'starry-word-rider'},'*'); } catch {}
  }

  function deliverCheckpoint() {
    const count=state.bag.length;
    state.delivered+=count;state.bag=[];state.stage++;
    showDelivery(count);
    const mostRecent=state.current;
    if(mostRecent?.sentence) {
      // At the chapel briefly say a whole example sentence, then resume word review.
      const token=++voiceToken;cancelPendingVoiceOnly();
      speakOne(mostRecent.sentence,lesson.learningLanguage,()=>{
        if(token===voiceToken && state.current && state.repeat && state.started&&!state.paused) utteranceTimer=setTimeout(()=>startWordLoop(state.current),state.speechGap);
      });
    }
    updateHud();
    try{window.parent?.postMessage({type:'GOLINGO_GAME_EVENT',event:'wordsDelivered',count,total:state.delivered,game:'starry-word-rider'},'*');}catch{}
  }

  function update(dt,time) {
    if(!state.started||state.paused)return;
    state.moment+=dt;
    const turn=clamp((keys.right?1:0)-(keys.left?1:0)+keys.joyX,-1,1);
    let targetSpeed=state.autoRide?12.5:4.5;
    if(keys.forward||keys.joyY<-.18) targetSpeed=19.5;
    const braking=keys.brake||keys.joyY>.24;
    if(braking)targetSpeed=2.8;
    state.speed=lerp(state.speed,targetSpeed,clamp(dt*(braking?3:1.4),0,1));
    state.lane=clamp(state.lane+turn*dt*(3.4+state.speed*.27),-roadWidth*.43,roadWidth*.43);
    if(!turn)state.lane*=Math.pow(.99,dt*60);
    state.lean=lerp(state.lean,turn,clamp(dt*7,0,1));
    state.z+=state.speed*dt;
    if(state.jumpY>0 || state.jumpVel>0) {
      state.jumpY+=state.jumpVel*dt;
      state.jumpVel-=25*dt;
      if(state.jumpY<0){state.jumpY=0;state.jumpVel=0;state.jumpCount=0;}
    }
    for(const orb of orbs) {
      if(orb.z<state.z-4){Object.assign(orb,makeOrb());continue;}
      if(orb.z<=state.z+3 && orb.z>=state.z-3.5 && Math.abs(orb.offset-state.lane)<3.65)collectOrb(orb,time);
    }
    if(state.z>=(state.stage+1)*240)deliverCheckpoint();
    if(time-lastHudUpdate>180){lastHudUpdate=time;updateHud();}
  }

  let lastDrawTime=-Infinity;
  function frame(time) {
    const dt=clamp((time-lastTime)/1000,0,.045);lastTime=time;
    update(dt,time);
    if(state.started&&!state.paused)rideAudio?.update(state.speed,time);
    // The 2D fallback used to repaint hundreds of vector details at full
    // retina resolution 60 times a second, even underneath the intro video.
    // Physics/input still update every rAF; only the expensive canvas paint
    // is paced to an achievable cadence on phones.
    const interval=!state.started?900:state.paused?160:W<730?24:16;
    if(time-lastDrawTime>=interval){
      draw(time,Number.isFinite(lastDrawTime)?clamp((time-lastDrawTime)/1000,0,.06):dt);
      lastDrawTime=time;
    }
    requestAnimationFrame(frame);
  }

  function cancelPendingVoiceOnly() {
    if(utteranceTimer)clearTimeout(utteranceTimer);utteranceTimer=null;
    if(playingAudio){try{playingAudio.onended=null;playingAudio.onerror=null;playingAudio.pause();playingAudio.currentTime=0;}catch{}playingAudio=null;}
    currentUtterance=null;
    try{window.speechSynthesis?.cancel();}catch{}
  }
  function cancelSpeech() { voiceToken++;cancelPendingVoiceOnly(); }

  function speakOne(text,language,onDone,audioURL='',force=false) {
    if((!state.audioOn&&!force) || !text || (!state.started&&!force) || (state.paused&&!force)){onDone?.(false);return;}
    const token=voiceToken;let finished=false;
    const done=ok=>{
      if(finished||token!==voiceToken)return;finished=true;playingAudio=null;currentUtterance=null;
      onDone?.(ok);
    };
    if(audioURL) {
      try {
        const url=new URL(audioURL,location.href);
        if(['http:','https:','blob:','data:'].includes(url.protocol)){
          // Reuse the element activated by Play instead of creating a new,
          // potentially autoplay-blocked media element for every word.
          const sound=sharedWordAudio||(sharedWordAudio=new Audio());playingAudio=sound;sound.src=url.href;
          sound.onended=()=>done(true);
          const fallback=()=>{
            if(finished||token!==voiceToken)return;finished=true;playingAudio=null;
            sound.onended=null;sound.onerror=null;try{sound.pause();}catch{}
            speakOne(text,language,onDone,'',force);
          };
          sound.onerror=fallback;
          sound.play()?.catch?.(fallback);return;
        }
      }catch{}
    }
    if(!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined'){
      voiceNotice='Word voice is unavailable in this browser. Try imported audio recordings or another browser.';
      updateSoundUi();done(false);return;
    }
    const u=new SpeechSynthesisUtterance(text);u.lang=getLocale(language);u.rate=.84;u.pitch=1.04;u.volume=.98;
    let voices=[];try{voices=window.speechSynthesis.getVoices()||[];}catch{}
    const exact=voices.find(v=>v.lang.toLowerCase()===u.lang.toLowerCase());
    const prefix=voices.find(v=>v.lang.toLowerCase().startsWith(u.lang.toLowerCase().split('-')[0]));
    if(exact||prefix)u.voice=exact||prefix;
    currentUtterance=u;
    u.onstart=()=>{if(token===voiceToken){voiceNotice='';updateSoundUi();}};
    u.onend=()=>done(true);
    u.onerror=event=>{
      if(token!==voiceToken)return;
      voiceNotice=event.error==='not-allowed'?
        'Tap Test Voice to enable pronunciation on this device.':
        'Pronunciation could not play. Tap Test Voice; check your media volume and installed language voices.';
      updateSoundUi();done(false);
    };
    try { window.speechSynthesis.resume();window.speechSynthesis.speak(u); }
    catch{voiceNotice='Tap Test Voice to try pronunciation again.';updateSoundUi();done(false);}
  }
  function startWordLoop(item) {
    cancelSpeech();if(!item || !state.audioOn || !state.started||state.paused)return;
    const token=voiceToken;
    const step=()=>{
      if(token!==voiceToken||state.paused||!state.started||!state.audioOn)return;
      speakOne(item.word,lesson.learningLanguage,ok=>{
        if(token!==voiceToken||ok===false)return;
        if(state.repeat) utteranceTimer=setTimeout(step,state.speechGap);
      },item.audioURL);
    };
    step();
  }

  function updateSoundUi() {
    const status=rideAudio?.status||'unavailable';
    const labels={ready:'SOUND ON',locked:'TAP FOR SOUND',muted:'SOUND OFF',paused:state.started?'SOUND PAUSED':'SOUND READY',unavailable:'NO GAME SOUND',disposed:'SOUND OFF'};
    if($('ambienceState'))$('ambienceState').textContent=labels[status]||'SOUND OFF';
    if($('ambienceBtn')){
      $('ambienceBtn').classList.toggle('is-off',!state.fxOn||status==='locked'||status==='unavailable');
      $('ambienceBtn').setAttribute('aria-label',status==='locked'?'Enable game sound':state.fxOn?'Turn off music and effects':'Turn on music and effects');
    }
    if($('ambienceToggle'))$('ambienceToggle').checked=state.fxOn;
    if($('audioStatus')){
      const messages={ready:'Music and effects are ready. Word pronunciation has its own switch.',locked:'Tap Sound or Test Sound to enable audio on this device.',muted:'Music and effects are off. Word pronunciation is controlled separately.',paused:'Sound is paused with the ride. Test Sound still works here.',unavailable:'Game sound is unavailable in this browser. You can still test word pronunciation.'};
      $('audioStatus').textContent=voiceNotice||messages[status]||'';
    }
  }
  function startAmbient() {
    // Called only by trusted controls, never by the intro's ended event.
    if(!rideAudio){updateSoundUi();return;}
    rideAudio.unlock().then(updateSoundUi);
  }
  function setAmbientVolume() {
    rideAudio?.setEnabled(state.fxOn);
    rideAudio?.setPaused(!state.started||state.paused);
    updateSoundUi();
  }
  function playPickupChime() {
    if(state.fxOn)rideAudio?.chime(720);
  }

  function startRide() {
    if(state.started)return;
    state.started=true;state.paused=false;
    $('introBackdrop').classList.add('hidden');
    try{$('introVideo').pause();}catch{}
    if(!state.current)state.current=lesson.words[0];
    setAmbientVolume();startAmbient();updateHud();updateWordCard();
    // This first word is requested directly from Play, not from a timer. It
    // unlocks iOS pronunciation before automatic collection/review begins.
    if(state.current)startWordLoop(state.current);
    try{window.parent?.postMessage({type:'GOLINGO_GAME_EVENT',event:'started',game:'starry-word-rider'},'*');}catch{}
  }
  function pauseFor(id) {
    if(!state.started)return;
    state.paused=true;resetSteering();cancelSpeech();setAmbientVolume();
    $(id).classList.remove('hidden');
    if(id==='bookModal')fillWordBook();
  }
  function resumeRide() {
    $('pauseModal').classList.add('hidden');$('bookModal').classList.add('hidden');
    state.paused=false;setAmbientVolume();startAmbient();
    if(!state.current)state.current=lesson.words[0];
    updateWordCard();if(state.current)startWordLoop(state.current);
  }
  function jump() {
    if(!state.started||state.paused)return;
    if(state.jumpCount>=3)return;
    state.jumpCount++;
    state.jumpVel=state.jumpCount===3?12.7:9.8;
    if(state.jumpCount===1)showJumpText('Leap into the night ✦');
    else if(state.jumpCount===3)showJumpText('Triple jump! ✷');
    else showJumpText('Up among the stars ✦');
  }
  function trick() {
    if(!state.started||state.paused)return;
    if(state.jumpY<.45)jump();
    state.trickStart=performance.now();state.trickUntil=state.trickStart+730;
    showJumpText('A starry little spin ✧');
  }

  function fillWordBook() {
    const container=$('wordList');container.textContent='';
    if(!state.discovered.length){const empty=document.createElement('div');empty.className='empty-collection';empty.textContent='Your first glowing word is just down the road.';container.appendChild(empty);return;}
    const unique=[...new Map(state.discovered.map((w,i)=>[String(w.id)+'|'+w.word,w])).values()].reverse();
    for(const item of unique){
      const b=document.createElement('button');b.type='button';b.className='word-item';
      const c=document.createElement('span'),main=document.createElement('strong'),sub=document.createElement('small'),sp=document.createElement('span');
      main.textContent=item.word;sub.textContent=item.translation;c.append(main,sub);sp.className='speaker';sp.textContent='↻';b.append(c,sp);
      b.addEventListener('click',()=>{
        startAmbient();cancelSpeech();speakOne(item.word,lesson.learningLanguage,()=>{},item.audioURL,true);
      });container.appendChild(b);
    }
    $('bookDot').classList.remove('show');
  }

  function exportPayload() {
    return { primaryLanguage:lesson.primaryLanguage,learningLanguage:lesson.learningLanguage,
      words:state.discovered.map(entry=>({id:entry.id,word:entry.word,translation:entry.translation,sentence:entry.sentence||'',sentenceTranslation:entry.sentenceTranslation||''})) };
  }

  function pressHold(button,key) {
    const el=$(button);if(!el)return;
    const release=()=>{keys[key]=false;el.classList.remove('pressed');};
    el.addEventListener('pointerdown',e=>{e.preventDefault();keys[key]=true;el.classList.add('pressed');try{el.setPointerCapture(e.pointerId);}catch{}});
    el.addEventListener('pointerup',release);el.addEventListener('pointercancel',release);el.addEventListener('lostpointercapture',release);
  }

  function bindUI() {
    $('startBtn').addEventListener('click',startRide);
    $('skipIntroBtn').addEventListener('click',startRide);
    // Ending muted video is not a user gesture. Keep the Ride button visible
    // until a real tap enables both Web Audio and vocabulary pronunciation.
    $('introVideo').addEventListener('ended',()=>{$('startBtn').focus({preventScroll:true});});
    $('languageSelect').addEventListener('change',e=>{
      if(importedLesson && e.target.value===importedLesson.learningLanguage) setLesson(importedLesson,true);
      else{lesson=demoLesson(e.target.value);resetRide(true);$('missionNote').classList.remove('faded');}
    });
    pressHold('leftBtn','left');pressHold('rightBtn','right');
    // The compatibility renderer uses the SAME enlarged wheel as 3D mode.
    // Its entire wrapper captures a finger, not just the small centre knob.
    const wheel=$('joystickWrap'),track=$('joystickTrack'),knob=$('joystickKnob');
    if(wheel&&track&&knob){
      let pointer=null;
      const moveWheel=e=>{
        const r=track.getBoundingClientRect();
        const dx=e.clientX-r.left-r.width*.5,dy=e.clientY-r.top-r.height*.5;
        keys.joyX=clamp(dx/Math.max(1,r.width*.33),-1,1);
        keys.joyY=clamp(dy/Math.max(1,r.height*.33),-1,1);
        const travel=Math.max(1,r.width*.27);
        knob.style.transform=`translate(calc(-50% + ${keys.joyX*travel}px),calc(-50% + ${keys.joyY*travel}px))`;
      };
      const releaseWheel=e=>{
        if(e&&pointer!==e.pointerId)return;
        const captured=pointer;pointer=null;keys.joyX=keys.joyY=0;
        wheel.classList.remove('control-active');knob.style.transform='translate(-50%,-50%)';
        try{if(captured!==null&&wheel.hasPointerCapture?.(captured))wheel.releasePointerCapture(captured);}catch{}
      };
      resetSteering=()=>{releaseWheel();keys.left=keys.right=keys.forward=keys.brake=false;};
      wheel.addEventListener('pointerdown',e=>{
        if(!state.started||state.paused||pointer!==null)return;
        e.preventDefault();e.stopPropagation();pointer=e.pointerId;
        wheel.classList.add('control-active');try{wheel.setPointerCapture(pointer);}catch{}
        moveWheel(e);
      });
      wheel.addEventListener('pointermove',e=>{
        if(pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();moveWheel(e);
      });
      for(const type of ['pointerup','pointercancel','lostpointercapture'])wheel.addEventListener(type,releaseWheel);
    }
    $('jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();jump();});
    $('trickBtn').addEventListener('pointerdown',e=>{e.preventDefault();trick();});
    $('pedalBtn').addEventListener('click',()=>{state.autoRide=!state.autoRide;$('autorideToggle').checked=state.autoRide;updateHud();});
    $('soundBtn').addEventListener('click',()=>{state.audioOn=!state.audioOn;cancelSpeech();startAmbient();
      $('voiceToggle').checked=state.audioOn;
      try{localStorage.setItem('golingoStarryVoice',state.audioOn?'on':'off');}catch{}
      if(state.audioOn){
        if(!state.current)state.current=lesson.words[0];
        if(state.started&&!state.paused)startWordLoop(state.current);
        else speakOne(state.current.word,lesson.learningLanguage,()=>{},state.current.audioURL,true);
      }
      updateHud();updateWordCard();});
    $('ambienceBtn')?.addEventListener('click',()=>{
      state.fxOn=rideAudio?.status==='locked'?true:!state.fxOn;
      try{localStorage.setItem('golingoStarryAmbience',state.fxOn?'on':'off');}catch{}
      setAmbientVolume();if(state.fxOn)startAmbient();updateHud();
    });
    $('ambienceToggle')?.addEventListener('change',e=>{
      state.fxOn=e.target.checked;
      try{localStorage.setItem('golingoStarryAmbience',state.fxOn?'on':'off');}catch{}
      setAmbientVolume();if(state.fxOn)startAmbient();
    });
    $('testAudioBtn')?.addEventListener('click',()=>{
      voiceNotice='';state.fxOn=true;
      try{localStorage.setItem('golingoStarryAmbience','on');}catch{}
      setAmbientVolume();rideAudio?.test().then(ok=>{
        voiceNotice=ok?'Two-note sound test sent to the speakers. If silent, check media volume and Silent Mode.':'Sound is still blocked. Tap Test Sound again; check browser and device audio settings.';
        updateSoundUi();
      });updateSoundUi();
    });
    $('testVoiceBtn')?.addEventListener('click',()=>{
      startAmbient();cancelSpeech();voiceNotice='';
      const item=state.current||lesson.words[0];
      if(item)speakOne(item.word,lesson.learningLanguage,()=>{},item.audioURL,true);
    });
    $('hideBtn').addEventListener('click',()=>{state.showCard=!state.showCard;updateWordCard();updateHud();});
    $('translationBtn').addEventListener('click',()=>{state.showMeaning=!state.showMeaning;$('meaningToggle').checked=state.showMeaning;updateWordCard();});
    $('repeatBtn').addEventListener('click',()=>{if(state.current){startAmbient();cancelSpeech();speakOne(state.current.word,lesson.learningLanguage,ok=>{if(ok!==false&&state.repeat&&!state.paused)utteranceTimer=setTimeout(()=>startWordLoop(state.current),state.speechGap);},state.current.audioURL,true);}});
    $('pauseBtn').addEventListener('click',()=>state.paused?resumeRide():pauseFor('pauseModal'));
    $('bookBtn').addEventListener('click',()=>pauseFor('bookModal'));
    $('resumeBtn').addEventListener('click',resumeRide);
    $('restartBtn').addEventListener('click',()=>{resetRide(true);resumeRide();});
    $('repeatToggle').addEventListener('change',e=>{state.repeat=e.target.checked;cancelSpeech();if(state.current)startWordLoop(state.current);});
    $('voiceToggle').addEventListener('change',e=>{if(e.target.checked!==state.audioOn)$('soundBtn').click();});
    $('speechGapSelect').addEventListener('change',e=>{
      state.speechGap=clamp(Number(e.target.value)||2200,1000,6000);
      try{localStorage.setItem('golingoStarrySpeechGap',String(state.speechGap));}catch{}
      if(state.current)startWordLoop(state.current);
    });
    $('autorideToggle').addEventListener('change',e=>{state.autoRide=e.target.checked;updateHud();});
    $('meaningToggle').addEventListener('change',e=>{state.showMeaning=e.target.checked;updateWordCard();});
    document.querySelectorAll('[data-close]').forEach(btn=>btn.addEventListener('click',resumeRide));
    document.querySelectorAll('.modal-backdrop').forEach(backdrop=>backdrop.addEventListener('click',e=>{if(e.target===backdrop)resumeRide();}));
    $('fullscreenBtn').addEventListener('click',async()=>{
      try{if(!document.fullscreenElement)await $('game').requestFullscreen();else await document.exitFullscreen();}catch{}
      try{await screen.orientation?.lock?.('landscape');}catch{}
    });
    $('exportWordsBtn').addEventListener('click',()=>{
      const text=JSON.stringify(exportPayload(),null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='golingo-starry-words.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('copyWordsBtn').addEventListener('click',async()=>{
      const content=state.discovered.map(e=>`${e.word} — ${e.translation}`).join('\n');
      try{await navigator.clipboard.writeText(content||'No words collected yet.');$('copyWordsBtn').textContent='COPIED ✓';setTimeout(()=>$('copyWordsBtn').textContent='COPY WORDS',1400);}catch{$('copyWordsBtn').textContent='COPY UNAVAILABLE';}
    });
    canvas.addEventListener('pointerdown',e=>{
      if(!state.started||state.paused)return;
      const found=screenOrbs.find(o=>Math.hypot(o.x-e.clientX,o.y-e.clientY)<Math.max(30,o.r));
      if(found){startAmbient();cancelSpeech();speakOne(found.word.word,lesson.learningLanguage,ok=>{if(ok!==false&&state.current&&state.repeat)utteranceTimer=setTimeout(()=>startWordLoop(state.current),state.speechGap);},found.word.audioURL,true);}
    });
    window.addEventListener('keydown',e=>{
      const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown',' ','space','w','a','s','d','e'].includes(k))e.preventDefault();
      if(k==='escape'){if(!$('introBackdrop').classList.contains('hidden'))return;if(state.paused)resumeRide();else pauseFor('pauseModal');return;}
      if(k==='p'&&state.started){if(state.paused)resumeRide();else pauseFor('pauseModal');return;}
      if(!state.started||state.paused)return;
      if(k==='arrowleft'||k==='a')keys.left=true;
      if(k==='arrowright'||k==='d')keys.right=true;
      if(k==='arrowup'||k==='w')keys.forward=true;
      if(k==='arrowdown'||k==='s')keys.brake=true;
      if((k===' '||k==='space')&&!e.repeat)jump();
      if(k==='e'&&!e.repeat)trick();
      if(k==='m'&&!e.repeat)$('soundBtn').click();
      if(k==='r'&&!e.repeat)$('repeatBtn').click();
    },{passive:false});
    window.addEventListener('keyup',e=>{
      const k=e.key.toLowerCase();
      if(k==='arrowleft'||k==='a')keys.left=false;
      if(k==='arrowright'||k==='d')keys.right=false;
      if(k==='arrowup'||k==='w')keys.forward=false;
      if(k==='arrowdown'||k==='s')keys.brake=false;
    });
    window.addEventListener('blur',resetSteering);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){resetSteering();cancelSpeech();}
      else updateSoundUi(); // A new user control tap can resume pronunciation.
    });
  }

  resize();buildWorld();loadInitialLesson();
  audioReady.finally(()=>{
    bindUI();
    for(const id of ['startBtn','skipIntroBtn'])if($(id))$(id).disabled=false;
    updateSoundUi();
  });
  $('voiceToggle').checked=state.audioOn;
  $('autorideToggle').checked=state.autoRide;
  $('speechGapSelect').value=String(state.speechGap);
  requestAnimationFrame(frame);
})();
