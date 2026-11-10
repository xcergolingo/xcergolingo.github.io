/* Procedural F-16 Viper Demo study from Xin's reference photographs.
   Authored geometry; no remote model or texture dependencies. */
export function createF16(THREE, H) {
  const group = new THREE.Group();
  group.name = 'F-16 • Viper Demo';
  const M = {
    white: H.mat(0xf0f2ee, { roughness: .31, metalness: .18, clearcoat: .72 }),
    red: H.mat(0xee0d36, { roughness: .26, metalness: .18, clearcoat: .85 }),
    blue: H.mat(0x174098, { roughness: .28, metalness: .22, clearcoat: .8 }),
    grey: H.mat(0x7b919d, { roughness: .34, metalness: .48, clearcoat: .45 }),
    dark: H.mat(0x171e25, { roughness: .49, metalness: .2 }),
    titanium: H.mat(0xadb4b4, { roughness: .28, metalness: .85 }),
    black: H.mat(0x090e13, { roughness: .63, metalness: .06 }),
    recess: H.mat(0x32383b, { roughness: .57, metalness: .16 })
  };
  Object.entries(M).forEach(([name, mat]) => { mat.name = `Viper / ${name}`; });

  // The F-16's narrow nose, broad central shoulder, and single-engine tail.
  const bodyStations = [
    [-5.18,.485,.405,.015],[-4.7,.525,.435,.015],[-4.0,.57,.455,.02],
    [-3.0,.635,.485,.015],[-2.0,.716,.505,.015],[-1.0,.77,.52,.02],
    [0,.735,.51,.025],[1.0,.665,.48,.025],[2.0,.625,.465,.025],
    [3.0,.595,.455,.025],[3.8,.565,.445,.025],[4.5,.515,.418,.025]
  ];
  H.loft(group, 'Continuous white fuselage', bodyStations, M.white, {subdiv:5, segments:72});
  const radomeStations = [
    [4.495,.515,.418,.025],[4.9,.47,.388,.026],[5.35,.375,.325,.032],
    [5.75,.255,.237,.043],[6.08,.122,.13,.055],[6.28,.015,.021,.07]
  ];
  H.loft(group, 'Ogive grey radome', radomeStations, M.grey, {subdiv:5, segments:64});
  H.rod(group,'Pitot probe',[0,.07,6.24],[0,.07,6.61],.021,M.titanium,.006);
  H.rod(group,'Pitot black collar',[0,.07,6.24],[0,.07,6.35],.028,M.dark,.022);

  // Upper anti-glare panel and the narrow blue dorsal sweep.
  H.loft(group, 'Black anti-glare nose panel', [
    [3.53,.58,.459,.025],[3.8,.57,.453,.025],[4.496,.521,.425,.025]
  ], M.dark, {angleStart:-.76,angleLength:1.52,subdiv:5,segments:26});
  const dorsal = bodyStations.filter(s=>s[0]<=1.0).map(s=>[s[0],s[1]+.008,s[2]+.011,s[3]]);
  H.loft(group,'Blue dorsal livery',dorsal,M.blue,{angleStart:-.78,angleLength:1.56,segments:30});
  const stripeStations = bodyStations.map(s=>[s[0],s[1]+.009,s[2]+.01,s[3]]);
  H.loft(group,'Port red cheatline',stripeStations,M.red,{angleStart:1.91,angleLength:.20,segments:8});
  H.loft(group,'Starboard red cheatline',stripeStations,M.red,{angleStart:4.173,angleLength:.20,segments:8});

  // Blended leading-edge root extensions are a defining part of this silhouette.
  for(const s of [-1,1]) {
    H.wing(group,`${s<0?'Port':'Starboard'} shoulder / LERX`,[
      [s*.44,3.30,-3.47,.05,.20],
      [s*.72,2.24,-3.34,.015,.15],
      [s*1.02,.97,-2.90,-.025,.10],
      [s*1.20,.58,-2.62,-.038,.065]
    ],M.white);
    H.wing(group,`${s<0?'Port':'Starboard'} red swept main wing`,[
      [s*.69,1.02,-2.70,-.005,.175],
      [s*1.23,.59,-2.71,-.012,.135],
      [s*2.80,-.59,-2.57,-.014,.085],
      [s*4.03,-1.45,-2.43,-.008,.045]
    ],M.red);
    H.box(group,`${s<0?'Port':'Starboard'} white tip rail`,[.115,.125,1.97],[s*4.075,.015,-1.88],M.white);
    H.box(group,'Tip rail mounting lug',[.21,.055,.21],[s*3.99,-.025,-1.42],M.white);
    H.box(group,'Tip rail mounting lug aft',[.21,.055,.21],[s*3.99,-.025,-2.14],M.white);
    H.rod(group,'Wingtip navigation light', [s*4.07,.064,-1.04], [s*4.07,.064,-1.14],.025,H.mat(s<0?0xee2940:0x44bb86,{emissive:s<0?0xaa051b:0x047b42,emissiveIntensity:.28}));
    // Lines follow the actual sweep, making the surfaces readable close up.
    H.line(group,'Main flap hinge',[[s*.96,.060,-1.86],[s*2.79,.038,-2.18],[s*3.88,.019,-2.21]],0x7b1328,.48);
    H.line(group,'Wing aileron split',[[s*2.99,.035,-2.20],[s*3.06,.013,-2.55]],0x7b1328,.50);
    H.line(group,'Leading edge hinge',[[s*1.24,.05,.49],[s*2.81,.023,-.68],[s*3.98,.009,-1.49]],0x8e1731,.40);
    H.line(group,'Wing root seam',[[s*.85,.09,.90],[s*1.27,.044,-.10],[s*1.18,.047,-2.61]],0x781c30,.36);
    H.box(group,'Flaperon actuator cover',[.062,.065,.28],[s*3.07,-.047,-2.30],M.red);
    H.rod(group,'Trailing edge static wick',[s*3.25,-.004,-2.49],[s*3.25,-.004,-2.70],.011,M.dark);
    H.rod(group,'Trailing edge static wick',[s*3.73,-.004,-2.44],[s*3.73,-.004,-2.65],.010,M.dark);
    // Broad white all-moving stabilators with a slight anhedral.
    H.wing(group,`${s<0?'Port':'Starboard'} white stabilator`,[
      [s*.47,-3.05,-5.24,-.005,.115],
      [s*1.28,-3.64,-5.40,-.075,.084],
      [s*2.47,-4.36,-5.47,-.17,.045]
    ],M.white);
    H.line(group,'Stabilator leading edge',[[s*.68,.035,-3.25],[s*1.30,-.028,-3.72],[s*2.43,-.145,-4.39]],0x5a6a72,.26);
    H.line(group,'Stabilator inspection panel',[[s*.95,-.03,-4.65],[s*1.66,-.09,-4.88],[s*1.68,-.10,-5.28],[s*.95,-.03,-5.15],[s*.95,-.03,-4.65]],0x708089,.28);
    const vf = H.fin(group,'Lower ventral fin',[[-.40,-3.51],[-.43,-5.01],[-1.01,-4.67],[-.91,-4.06]],.043,s*.49,M.blue);
    vf.rotation.z = s*.13;
    H.rod(group,'Tail static wick',[s*2.20,-.16,-5.46],[s*2.20,-.16,-5.67],.009,M.dark);
  }

  // Chin intake: an actual recessed opening, with the white intake nacelle behind it.
  H.loft(group,'Sculpted underbody intake fairing',[
    [-1.20,.28,.17,-.34],[-.45,.43,.245,-.43],[.6,.49,.29,-.47],
    [1.56,.51,.32,-.49],[2.25,.49,.30,-.49],[2.53,.455,.275,-.485]
  ],M.white,{segments:56,subdiv:5});
  H.intake(group,'F-16 chin intake',{x:0,y:-.492,z:2.56,width:.91,height:.55,depth:1.1,color:0xf2f3ee});
  H.rod(group,'Intake splitter strut',[0,-.232,2.50],[0,-.08,2.50],.045,M.white);

  // A bubble canopy, complete with a visible pilot and a detailed single seat.
  const cockpit = H.cockpit(group,{z:2.43,y:.405,length:2.73,width:1.05,height:.57,seats:1,frame:0x202830,glass:0x9eb9c8,pilot:true});
  H.loft(group,'Blue spine behind cockpit',[
    [-3.18,.29,.105,.43],[-2.31,.325,.12,.455],[-.82,.29,.13,.48],
    [.60,.26,.13,.45],[1.09,.26,.11,.43]
  ],M.blue,{subdiv:5,segments:40,angleStart:-Math.PI/2,angleLength:Math.PI});

  // Vertical fin is a real solid fin; the colour and lettering conform to its faces.
  const finShape = [[.39,-2.15],[.63,-2.71],[2.72,-4.29],[2.69,-5.54],[.39,-5.16]];
  H.fin(group,'Swept vertical fin',finShape,.115,0,M.red);
  const finY0=.39, finY1=2.72, finZ0=-5.54, finZ1=-2.15;
  function finFace(side) {
    const can = document.createElement('canvas'); can.width=1536; can.height=1024;
    const ctx=can.getContext('2d'); const w=can.width,h=can.height;
    const ypix = y => h-(y-finY0)/(finY1-finY0)*h;
    ctx.fillStyle='#f00d38';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#f3f3ed';ctx.fillRect(0,ypix(1.43),w,h-ypix(1.43));
    ctx.fillStyle='#173c9c';ctx.fillRect(0,ypix(.71),w,h-ypix(.71));
    ctx.fillStyle='#141719';ctx.textAlign='center';ctx.textBaseline='middle';
    const center=side>0?.78:.22;
    ctx.font='italic 800 103px Arial, sans-serif';
    ctx.fillText('Viper Demo',w*center,ypix(2.43),w*.40);
    const bandCenter=side>0?.638:.362;
    ctx.font='italic 800 44px Arial, sans-serif';
    ctx.fillText('20TH FIGHTER WING',w*bandCenter,ypix(1.315),w*.58);
    ctx.font='italic 900 190px Arial Black, Arial, sans-serif';
    ctx.fillText('F16',w*bandCenter,ypix(1.016),w*.53);
    ctx.fillStyle='#f6f6ed';ctx.font='700 71px Arial, sans-serif';
    ctx.fillText('SW',w*(side>0?.45:.55),ypix(.525),w*.18);
    ctx.font='700 39px Arial, sans-serif';
    ctx.fillText('AF',w*(side>0?.585:.415),ypix(.576),w*.075);
    ctx.fillText('91',w*(side>0?.585:.415),ypix(.474),w*.075);
    ctx.font='700 78px Arial, sans-serif';
    ctx.fillText('395',w*(side>0?.725:.275),ypix(.521),w*.24);
    // Subtle access and rudder lines run beneath the graphics.
    ctx.strokeStyle='rgba(24,32,51,.25)';ctx.lineWidth=2;
    const zpix=z=>(side>0?(finZ1-z)/(finZ1-finZ0):(z-finZ0)/(finZ1-finZ0))*w;
    ctx.beginPath();ctx.moveTo(zpix(-5.26),ypix(2.61));ctx.lineTo(zpix(-4.94),ypix(.78));ctx.stroke();
    ctx.beginPath();ctx.moveTo(zpix(-4.0),ypix(.64));ctx.lineTo(zpix(-4.85),ypix(.64));ctx.stroke();
    const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.name='Viper fin livery';
    const material=H.mat(0xffffff,{map:tex,roughness:.30,metalness:.14,clearcoat:.72,side:THREE.DoubleSide});
    material.name=`Viper ${side>0?'right':'left'} fin paint`;
    const positions=[],uv=[];
    for(const [y,z] of finShape){positions.push(side*.083,y,z);uv.push(side>0?(finZ1-z)/(finZ1-finZ0):(z-finZ0)/(finZ1-finZ0),(y-finY0)/(finY1-finY0));}
    const points=finShape.map(([y,z])=>new THREE.Vector2(z,y));
    const faces=THREE.ShapeUtils.triangulateShape(points,[]).flat();
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(faces);geo.computeVertexNormals();
    H.mesh(group,'Painted vertical fin face',geo,material);
  }
  finFace(-1);finFace(1);
  H.rod(group,'Fin tip cap',[0,2.70,-4.31],[0,2.67,-5.55],.039,M.red);
  H.rod(group,'Fin trailing static wick',[0,2.20,-5.47],[0,2.20,-5.70],.011,M.dark);
  H.rod(group,'Fin trailing static wick',[0,1.70,-5.38],[0,1.70,-5.61],.011,M.dark);
  H.rod(group,'Tail antenna',[0,2.03,-3.79],[0,2.03,-3.34],.025,M.red);
  H.fin(group,'Dorsal radio blade',[[.57,-1.43],[.82,-1.56],[.81,-1.88],[.55,-1.94]],.026,0,M.white);

  // Surface-conforming fuselage graphics avoid floating label rectangles.
  function crossSection(z) {
    let a=bodyStations[0],b=bodyStations[1];
    for(let i=1;i<bodyStations.length;i++) { if(z<=bodyStations[i][0]) {a=bodyStations[i-1];b=bodyStations[i];break;} a=bodyStations[i-1];b=bodyStations[i]; }
    const t=THREE.MathUtils.clamp((z-a[0])/(b[0]-a[0]),0,1);
    return [a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];
  }
  function sideDecal(name,side,z,y,width,height,draw) {
    const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=384;
    draw(canvas.getContext('2d'),canvas.width,canvas.height);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.name=name;
    const mat=H.mat(0xffffff,{map:tex,transparent:true,depthWrite:false,roughness:.39,metalness:.1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    const p=[],uv=[],idx=[],nu=44,nv=6;
    for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){
      const u=i/nu,v=j/nv,zz=z+(side>0?.5-u:u-.5)*width,yy=y+(v-.5)*height;
      const [rx,ry,cy]=crossSection(zz);const ratio=THREE.MathUtils.clamp((yy-cy)/ry,-.98,.98);
      p.push(side*(rx*Math.sqrt(1-ratio*ratio)+.013),yy,zz);uv.push(u,v);
    }
    for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const k=j*(nu+1)+i;idx.push(k,k+1,k+nu+1,k+1,k+nu+2,k+nu+1);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
    return H.mesh(group,name,geo,mat);
  }
  for(const s of [-1,1]) {
    sideDecal('U.S. AIR FORCE fuselage lettering',s,.99,.027,3.37,.345,(c,w,h)=>{
      c.fillStyle='#182024';c.textAlign='center';c.textBaseline='middle';c.font='italic 800 228px Arial, sans-serif';c.fillText('U.S. AIR FORCE',w*.5,h*.51,w*.97);
    });
    sideDecal('Fuselage national insignia',s,-3.19,.015,.90,.34,(c,w,h)=>H.usRoundel(c,w,h));
    sideDecal('Rescue arrow and safety stencils',s,3.20,-.028,.78,.24,(c,w,h)=>{
      c.fillStyle='#edb934';c.beginPath();c.moveTo(w*.05,h*.34);c.lineTo(w*.45,h*.34);c.lineTo(w*.45,h*.18);c.lineTo(w*.60,h*.48);c.lineTo(w*.45,h*.78);c.lineTo(w*.45,h*.62);c.lineTo(w*.05,h*.62);c.closePath();c.fill();
      c.fillStyle='#202327';c.font='700 44px Arial';c.fillText('RESCUE',w*.08,h*.535,w*.32);
      c.fillStyle='#1a2023';c.fillRect(w*.68,h*.32,w*.28,h*.41);c.fillStyle='#ffcc49';c.font='600 20px Arial';c.fillText('DANGER',w*.71,h*.45);c.fillText('EJECTION SEAT',w*.70,h*.57,w*.24);
      c.fillStyle='#6d7377';c.font='23px Arial';c.fillText('WARNING',w*.13,h*.13,w*.3);
    });
    sideDecal('Ejection warning triangle',s,2.57,.239,.18,.16,(c,w,h)=>{
      c.fillStyle='#d72a32';c.beginPath();c.moveTo(w*.12,h*.10);c.lineTo(w*.88,h*.10);c.lineTo(w*.5,h*.90);c.closePath();c.fill();
      c.fillStyle='#fff';c.beginPath();c.moveTo(w*.24,h*.22);c.lineTo(w*.76,h*.22);c.lineTo(w*.5,h*.70);c.closePath();c.fill();
    });
    sideDecal('Forward maintenance stencils',s,3.75,-.025,.39,.19,(c,w,h)=>{
      c.strokeStyle='#919a9e';c.lineWidth=7;c.strokeRect(w*.13,h*.18,w*.28,h*.39);c.strokeRect(w*.52,h*.18,w*.27,h*.39);
      c.fillStyle='#777e82';for(let i=0;i<5;i++)c.fillRect(w*.1,h*(.7+i*.045),w*(.55-i*.055),h*.013);
    });
  }
  H.decal(group,'Wing star and bars',{width:1.15,height:.67,pos:[2.79,.064,-1.68],rot:[-Math.PI/2,0,Math.PI/2],draw:(c,w,h)=>H.usRoundel(c,w,h)});
  H.decal(group,'USAF upper wing lettering',{width:1.48,height:.55,pos:[-2.71,.067,-1.59],rot:[-Math.PI/2,0,-Math.PI/2],draw:(c,w,h)=>{
    c.fillStyle='#20252a';c.textAlign='center';c.textBaseline='middle';c.font='800 330px Arial';c.fillText('USAF',w*.5,h*.5,w*.96);
  }});
  H.decal(group,'Aerial refuelling receptacle marking',{width:.57,height:.82,pos:[0,.611,.08],rot:[-Math.PI/2,0,0],draw:(c,w,h)=>{
    c.strokeStyle='#f1f0df';c.lineWidth=12;c.beginPath();c.moveTo(w*.25,h*.86);c.lineTo(w*.25,h*.28);c.quadraticCurveTo(w*.5,-h*.03,w*.75,h*.28);c.lineTo(w*.75,h*.86);c.closePath();c.stroke();
    c.lineWidth=8;c.beginPath();c.moveTo(w*.15,h*.38);c.lineTo(w*.85,h*.38);c.moveTo(w*.50,h*.10);c.lineTo(w*.5,h*.86);c.stroke();
  }});

  // Restrained engraved panel detail; no thick wireframe on the finished model.
  function skinPoint(z,theta,extra=.014){const [rx,ry,cy]=crossSection(z);return [(rx+extra)*Math.sin(theta),cy+(ry+extra)*Math.cos(theta),z];}
  for(const z of [-4.66,-3.5,-2.32,-.69,.67,3.30,4.46]) {
    const pts=[];for(let i=0;i<=72;i++)pts.push(skinPoint(z,i/72*Math.PI*2));H.line(group,'Fuselage frame seam',pts,0x516373,.20);
  }
  for(const angle of [1.29,-1.29,2.62,-2.62]) {
    const pts=[];for(let i=0;i<=60;i++)pts.push(skinPoint(-4.83+i/60*9.19,angle));H.line(group,'Longitudinal skin joint',pts,0x526271,.17);
  }
  // Fine radome panel join ring and top lightning strip.
  const ring=[];for(let i=0;i<=64;i++){let a=i/64*Math.PI*2;ring.push([.52*Math.sin(a),.025+.423*Math.cos(a),4.505]);}H.line(group,'Radome join ring',ring,0x28333a,.48);
  H.line(group,'Radome lightning conductor',[[0,.448,4.56],[0,.413,4.93],[0,.358,5.30],[0,.279,5.63],[0,.176,5.95]],0xb7c6cd,.66);
  for(const s of [-1,1]) {
    H.ellipsoid(group,'Forward air-data port',[s*.572,.11,3.87],[.012,.033,.075],M.grey);
    H.rod(group,'Angle-of-attack probe',[s*.548,.0,4.08],[s*.70,.0,4.08],.015,M.titanium,.006);
    for(let i=0;i<5;i++) {
      H.box(group,'Nose avionics cooling slot',[.018,.036,.096],[s*.28,.445,3.86+i*.11],M.recess,[0,0,s*.24]);
    }
  }

  const exhaust = H.exhaust(group,{x:0,y:.015,z:-5.14,r:.475,length:.64});
  H.loft(group,'Bare metal engine collar',[[-5.20,.493,.418,.015],[-4.94,.504,.428,.015]],M.titanium,{segments:64,subdiv:2});
  // The nose bay follows the low chin fairing; the main wheels fold flat inside the fuselage.
  const gear = H.gear(group,{
    noseZ:2.02,mainZ:-1.01,track:1.06,groundY:-1.58,wheelRadius:.225,mainRadius:.315,
    noseHinge:[0,-.60,2.02],noseStow:[0,-.48,1.10],
    mainHinge:[.53,-.18,-1.01],mainStow:[.36,0,.10],mainFlat:true,
    noseBay:{min:[-.19,-10,.80],max:[.19,-.25,2.24]},
    mainBay:{min:[.035,-10,-1.21],max:[.76,.06,.52]},
    bayCeilingY:.16,noseBayCeilingY:-.18,
    skinNames:[
      'Continuous white fuselage','Sculpted underbody intake fairing','Intake outer fairing',
      'Port red cheatline','Starboard red cheatline',
      'Port shoulder / LERX','Starboard shoulder / LERX',
      'Port red swept main wing','Starboard red swept main wing'
    ]
  });
  gear.setDown(1);cockpit.setOpen(0);
  group.userData = { modelId:'f16', label:'F-16 Viper Demo', photoReference:'IMG_6740 / IMG_6741 / IMG_6742', kind:'Procedural artistic reconstruction', noseAxis:'+Z', landingGear:true };
  return {
    group,
    update(dt,state={}) {
      gear.setDown(state.gear ?? 1);
      cockpit.setOpen(state.canopy ?? 0);
      if(exhaust.glow?.material) exhaust.glow.material.emissiveIntensity=.12+(state.engine??0)*3.0;
    },
    info: { name:'F-16 Viper Demo', subtitle:'Red, white & blue display livery', features:['Single-seat bubble cockpit','Chin intake & single nozzle','Three-wheel landing gear','Photo-matched fin markings'] }
  };
}
