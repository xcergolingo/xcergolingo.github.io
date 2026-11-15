import * as THREE from './vendor/three.module.js';

// A small lateral drift separates the two ends of the full vertical loop.
// Both spirals are sampled as real three-dimensional geometry, not visual props.
const cometLoop = Array.from({length:33},(_,i) => {
  const angle=i/32*Math.PI*2;
  return [55+10*i/32,10+24*(1-Math.cos(angle)),35-24*Math.sin(angle)];
});
const tidalHelix = Array.from({length:49},(_,i) => {
  const angle=i/48*Math.PI*4;
  return [34+36*Math.cos(angle),64-50*i/48,-36-36*Math.sin(angle)];
});

// Each ride shares the boarding platform, then follows its own complete circuit.
// Speed values are metres per second; heights and lengths are metres.
const definitions = [
  {
    id:'sunburst', name:'The Sunburst', kicker:'THE SIGNATURE RIDE',
    description:'The original skyline climb, sweeping turns, and sunshine drop.',
    intensity:'Classic', pace:'Big hills · flowing turns', color:'#ef6748',
    maxSpeed:43, liftSpeed:9.4, assistSpeed:7, bankStrength:18, maxBank:.71,
    points:[
    [-60,7,65],[-45,7,65],[-25,9,65],[-10,25,62],[8,53,56],
    [25,62,43],[42,55,25],[47,16,0],[35,6,-20],[10,7,-32],
    [-12,28,-48],[-27,36,-65],[-48,21,-75],[-70,8,-60],
    [-82,9,-30],[-75,22,-3],[-50,24,0],[-27,12,-5],[-5,6,0],
    [25,28,4],[55,34,-4],[75,18,-23],[85,8,-45],[75,7,-66],
    [50,8,-79],[24,8,-82],[8,14,-70],[-3,17,-55],[-10,9,-35],
    [-22,6,-20],[-42,7,-15],[-60,12,0],[-66,10,24],[-63,7,45]
    ],
    sections:[
      [0,'Boardwalk station','station'],[2,'The sky climb','lift'],
      [5,'Sunshine drop','drop'],[8,'Canyon curves','turn'],
      [13,'Palm ridge','turn'],[16,'Lagoon flyby','cruise'],
      [20,'Coastal sweep','turn'],[26,'Homeward glide','cruise']
    ]
  },
  {
    id:'lagoon', name:'Lagoon Glide', kicker:'A GENTLE COASTAL ESCAPE',
    description:'Low hills and wide lagoon turns, with a gentler pace to listen.',
    intensity:'Gentle', pace:'Low hills · easy turns', color:'#279d9a',
    maxSpeed:20, liftSpeed:6.5, assistSpeed:6.2, bankStrength:9, maxBank:.32,
    points:[
      [-60,7,65],[-45,7,65],[-25,9,65],[0,16,62],[25,22,55],
      [52,24,41],[72,18,20],[84,11,-5],[90,8,-32],[82,9,-62],
      [60,14,-82],[32,17,-90],[4,14,-88],[-20,11,-74],
      [-39,10,-52],[-52,15,-26],[-58,16,0],[-55,12,24],[-63,8,45]
    ],
    sections:[
      [0,'Boardwalk station','station'],[2,'The gentle climb','lift'],
      [5,'Seabreeze glide','drop'],[8,'Lagoon lookout','turn'],
      [11,'Palm coast','cruise'],[14,'Garden bends','turn'],
      [16,'The homeward drift','cruise']
    ]
  },
  {
    id:'skyrocket', name:'Sky Rocket', kicker:'THE SKYLINE ADVENTURE',
    description:'Our tallest climb, steep drops, and high banked crossover turns.',
    intensity:'Exciting', pace:'Tall drops · fast turns', color:'#7475cf',
    maxSpeed:48, liftSpeed:10.5, assistSpeed:7.5, bankStrength:23, maxBank:.82,
    points:[
      [-60,7,65],[-45,7,65],[-25,9,65],[-5,40,63],[17,76,58],
      [42,88,44],[64,66,24],[72,20,0],[63,7,-25],[41,22,-45],
      [17,56,-67],[-10,61,-88],[-40,38,-99],[-63,11,-85],
      [-72,7,-61],[-62,13,-36],[-40,43,-15],[-9,56,-3],
      [24,46,-4],[47,33,-14],[76,35,-34],[101,47,-60],
      [104,40,-85],[82,18,-104],[54,9,-110],[23,15,-112],
      [-1,32,-103],[-20,28,-85],[-26,12,-56],[-17,8,-31],
      [-22,21,-8],[-45,30,12],[-65,19,26],[-67,8,46]
    ],
    sections:[
      [0,'Boardwalk station','station'],[2,'The rocket climb','lift'],
      [5,'Skyline plunge','drop'],[8,'Cloud nine crest','cruise'],
      [11,'North coast dive','drop'],[15,'Sky bridge','turn'],
      [18,'Ocean overbank','turn'],[22,'Seaside dive','drop'],
      [25,'The high crossover','turn'],[29,'Homeward rush','cruise']
    ]
  },
  {
    id:'comet', name:'Comet Loop', kicker:'LAUNCH INTO THE LOOP',
    description:'A magnetic launch sends you through a real upside-down loop and over the coast.',
    intensity:'Thrilling', pace:'Magnetic launch · 360° loop', color:'#f4a43a',
    isNew:true, theme:'day', features:['360° loop','Magnetic launch'], inversions:1,
    gateFractions:[.07,.44,.52,.60,.68,.76,.84,.92],
    maxSpeed:46, liftSpeed:9, assistSpeed:10, bankStrength:19, maxBank:.72,
    transportedFrames:true,
    points:[
      [-60,7,65],[-45,7,65],[-25,9,65],[0,10,65],[25,10,64],
      [44,10,58],[52,10,48],...cometLoop,
      [68,10,10],[76,21,-15],[98,40,-40],[95,28,-70],
      [78,10,-95],[50,9,-110],[18,24,-107],[-10,30,-96],
      [-38,15,-80],[-55,8,-52],[-56,12,-15],[-63,10,20],[-72,7,44],[-70,7,58]
    ],
    sections:[
      [0,'Boardwalk station','station'],
      [2,'Magnetic launch','launch',{targetSpeed:40}],
      [7,'The Comet loop','loop',{feature:'loop',minSpeed:14}],
      [40,'Comet coast','cruise'],[42,'Meteor drop','drop'],
      [45,'Orbit hills','cruise'],[48,'Homeward glide','cruise']
    ]
  },
  {
    id:'tidal', name:'Tidal Twister', kicker:'SPIRAL OVER THE LAGOON',
    description:'Climb above the water, then circle the lagoon in a sweeping two-level spiral.',
    intensity:'Exciting', pace:'Two-turn helix · lagoon sweep', color:'#179eb3',
    isNew:true, theme:'day', features:['Double helix','Lagoon spirals'], inversions:0,
    gateFractions:[.22,.31,.43,.53,.63,.73,.83,.93],
    maxSpeed:36, liftSpeed:8.6, assistSpeed:7.5, bankStrength:22, maxBank:.78,
    points:[
      [-60,7,65],[-45,7,65],[-25,9,65],[-5,28,62],
      [18,50,50],[44,62,25],[68,64,-5],...tidalHelix,
      [74,11,-63],[91,10,-88],[70,8,-108],[35,11,-115],
      [1,19,-105],[-30,14,-80],[-56,10,-44],[-60,10,-5],[-72,7,44],[-70,7,58]
    ],
    sections:[
      [0,'Boardwalk station','station'],[2,'The tidal climb','lift'],
      [6,'Lagoon lookout','turn'],[7,'The double helix','turn',{feature:'helix'}],
      [56,'Ocean skim','cruise'],[59,'Seabreeze hills','cruise'],
      [62,'Homeward drift','turn']
    ]
  },
  {
    id:'canyon', name:'Canyon Run', kicker:'CHASE THE GOLDEN HOUR',
    description:'A low, winding dash between sandstone walls, with two wide rock tunnels.',
    intensity:'Adventurous', pace:'Rock tunnels · low slalom', color:'#d86541',
    isNew:true, theme:'sunset', features:['Rock tunnels','Canyon slalom'], inversions:0,
    gateFractions:[.15,.25,.46,.54,.60,.76,.84,.93],
    maxSpeed:29, liftSpeed:7.5, assistSpeed:7.5, bankStrength:17, maxBank:.60,
    points:[
      [-60,7,65],[-45,7,65],[-25,9,65],[-2,16,63],[23,22,52],
      [48,20,35],[69,10,10],[77,6,-18],[65,6,-42],[87,8,-68],
      [74,12,-96],[45,14,-114],[16,7,-102],[4,6,-82],[-13,9,-68],
      [-18,13,-47],[-44,10,-32],[-60,6,-10],[-61,7,18],[-72,7,44],[-70,7,58]
    ],
    sections:[
      [0,'Boardwalk station','station'],[2,'Sandstone rise','lift'],
      [4,'Golden-hour dive','drop'],[7,'Echo tunnel','tunnel',{feature:'tunnel'}],
      [9,'Canyon slalom','turn'],[13,'Sunstone tunnel','tunnel',{feature:'tunnel'}],
      [15,'The winding pass','turn'],[17,'Boardwalk return','cruise']
    ]
  },
  {
    id:'starlight', name:'Starlight Express', kicker:'A RIDE UNDER THE STARS',
    description:'Ride a ribbon of light through rolling airtime hills beneath the evening sky.',
    intensity:'Flowing', pace:'Airtime hills · starlit arches', color:'#aa85ec',
    isNew:true, theme:'night', features:['Starlit arches','Airtime hills'], inversions:0,
    gateFractions:[.22,.31,.43,.53,.63,.73,.83,.93],
    maxSpeed:34, liftSpeed:8, assistSpeed:7, bankStrength:17, maxBank:.59,
    points:[
      [-60,7,65],[-45,7,65],[-25,9,65],[-3,24,61],
      [22,43,52],[52,48,32],[78,35,5],[97,17,-25],
      [105,22,-58],[87,42,-88],[58,50,-107],[23,31,-115],
      [-8,13,-109],[-39,17,-91],[-62,35,-66],[-70,39,-34],
      [-57,24,-2],[-61,15,19],[-72,8,44],[-70,7,58]
    ],
    sections:[
      [0,'Boardwalk station','station'],[2,'Twilight climb','lift'],
      [5,'Moonrise dip','drop'],[8,'Constellation hills','cruise',{feature:'starlight'}],
      [12,'Shooting-star sweep','turn'],[15,'The evening glide','cruise'],
      [18,'Home by starlight','turn']
    ]
  }
];

// Small reusable curve data keeps the picker previews identical to the real rides.
const routes = definitions.map(definition => {
  const points = definition.points.map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = 8192;
  curve.updateArcLengths();
  const length = curve.getLength();
  const samples = curve.getSpacedPoints(1200);
  const {points:ignoredPoints,sections:ignoredSections,transportedFrames:ignoredFrames,...metadata} = definition;
  const ride = Object.freeze({isNew:false,theme:'day',features:[],inversions:0,...metadata, lengthMeters:length,
    heightMeters:Math.max(...samples.map(p => p.y)),
    previewPoints:curve.getSpacedPoints(72).map(p => [p.x,p.z])});
  return {definition,points,curve,length,samples,ride};
});
export const RIDE_OPTIONS = Object.freeze(routes.map(route => route.ride));

/** The track uses arc-length distance everywhere. Local +Z is the direction of travel. */
export function createTrack(scene, rideId='sunburst') {
  const {definition,points,curve,length,samples,ride} = routes.find(route => route.ride.id===rideId) || routes[0];
  const worldUp = new THREE.Vector3(0,1,0);
  const wrap = d => ((d % length) + length) % length;
  const tangentAt = d => {
    if(!ride.isNew)return curve.getTangentAt(wrap(d)/length).normalize();
    // Sample both sides of the closed spline, including at the station seam.
    const t=curve.getUtoTmapping(wrap(d)/length),epsilon=.00001;
    return curve.getPoint((t+epsilon)%1).sub(curve.getPoint((t-epsilon+1)%1)).normalize();
  };
  const basis = new THREE.Matrix4();
  // Knot distances are monotonic even where an inverted circuit passes itself.
  // Keep the original rides' section boundaries identical to their first release.
  const arcLengths=curve.getLengths(curve.arcLengthDivisions);
  const distanceOfPoint = pointIndex => {
    if(!ride.isNew) {
      let best=Infinity,bestD=0;
      for(let i=0;i<samples.length;i++) {
        const distance=samples[i].distanceToSquared(points[pointIndex]);
        if(distance<best){best=distance;bestD=i/(samples.length-1)*length;}
      }
      return bestD;
    }
    const index=pointIndex/points.length*curve.arcLengthDivisions;
    const lower=Math.floor(index),fraction=index-lower;
    return THREE.MathUtils.lerp(arcLengths[lower],arcLengths[Math.min(lower+1,arcLengths.length-1)],fraction);
  };
  const sections=definition.sections.map(([pointIndex,name,type,details={}],index,all)=>({
    start:index?distanceOfPoint(pointIndex):0,
    end:index+1<all.length?distanceOfPoint(all[index+1][0]):length,
    name,type,...details
  }));
  const featureZones=sections.filter(section=>section.feature||['launch','loop','tunnel'].includes(section.type))
    .map(section=>({kind:section.feature||section.type,start:section.start,end:section.end}));
  const loopSection=sections.find(section=>section.type==='loop');

  // Parallel transport never references world up at a vertical tangent. The
  // closure correction removes the small residual twist around a complete lap.
  // Only the inverting ride needs this frame; existing banking is preserved.
  const frameSteps=4096,transportedRights=[];
  if(definition.transportedFrames) {
    const tangents=Array.from({length:frameSteps+1},(_,i)=>tangentAt(i/frameSteps*length));
    tangents[frameSteps].copy(tangents[0]);
    transportedRights.push(new THREE.Vector3().crossVectors(worldUp,tangents[0]).normalize());
    const rotation=new THREE.Quaternion();
    for(let i=1;i<=frameSteps;i++) {
      rotation.setFromUnitVectors(tangents[i-1],tangents[i]);
      const right=transportedRights[i-1].clone().applyQuaternion(rotation);
      right.addScaledVector(tangents[i],-right.dot(tangents[i])).normalize();
      transportedRights.push(right);
    }
    const first=transportedRights[0],last=transportedRights[frameSteps];
    const twist=Math.atan2(tangents[0].dot(new THREE.Vector3().crossVectors(last,first)),last.dot(first));
    for(let i=1;i<=frameSteps;i++)transportedRights[i].applyAxisAngle(tangents[i],twist*i/frameSteps);
    transportedRights[frameSteps].copy(first);
  }

  function getFrame(distanceMeters) {
    const d = wrap(distanceMeters);
    const position = curve.getPointAt(d / length);
    const tangent = tangentAt(d);
    let right;
    if(transportedRights.length) {
      const index=d/length*frameSteps,lower=Math.floor(index);
      right=transportedRights[lower].clone().lerp(transportedRights[lower+1],index-lower);
      right.addScaledVector(tangent,-right.dot(tangent)).normalize();
    } else right=new THREE.Vector3().crossVectors(worldUp,tangent).normalize();
    const up = new THREE.Vector3().crossVectors(tangent,right).normalize();
    const before = tangentAt(d-6); before.y=0; before.normalize();
    const after = tangentAt(d+6); after.y=0; after.normalize();
    const angle = Math.atan2(new THREE.Vector3().crossVectors(before,after).y, before.dot(after));
    const curvature = angle/12;
    let bank = THREE.MathUtils.clamp(-Math.atan(curvature*ride.bankStrength), -ride.maxBank,ride.maxBank);
    if(loopSection) {
      const lead=THREE.MathUtils.smoothstep(d,loopSection.start-20,loopSection.start);
      const tail=THREE.MathUtils.smoothstep(d,loopSection.end,loopSection.end+20);
      bank*=1-lead+tail;
    }
    right.applyAxisAngle(tangent,bank);
    up.applyAxisAngle(tangent,bank);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(right,up,tangent));
    return {position,tangent,right,up,quaternion};
  }
  const root = new THREE.Group(); root.name=`Suncoast — ${ride.name}`; scene.add(root);
  const mat = (color, extras={}) => new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.12,...extras});
  const railMat=mat(ride.color,{metalness:.34,roughness:.31});
  const tieMat=mat(new THREE.Color(ride.color).multiplyScalar(.73));
  const spineMat=mat(new THREE.Color(ride.color).multiplyScalar(.64));
  const steelMat=mat(0xf2ead3,{roughness:.48,metalness:.24});
  const tealMat=mat(0x306c6a,{roughness:.45,metalness:.23});
  const concreteMat=mat(0xd0cab5,{roughness:.9,metalness:0});
  const object = new THREE.Object3D();

  function tube(offsetX,offsetY,radius,material,radial=6) {
    const n=2200, positions=[],normals=[],indices=[];
    for(let i=0;i<=n;i++) {
      const f=getFrame(i/n*length);
      const center=f.position.clone().addScaledVector(f.right,offsetX).addScaledVector(f.up,offsetY);
      for(let j=0;j<radial;j++) {
        const a=j/radial*Math.PI*2;
        const normal=f.right.clone().multiplyScalar(Math.cos(a)).addScaledVector(f.up,Math.sin(a));
        const p=center.clone().addScaledVector(normal,radius);
        positions.push(p.x,p.y,p.z); normals.push(normal.x,normal.y,normal.z);
      }
      if(i<n) for(let j=0;j<radial;j++) {
        const a=i*radial+j,b=i*radial+(j+1)%radial,c=(i+1)*radial+j,e=(i+1)*radial+(j+1)%radial;
        indices.push(a,b,c,b,e,c);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setIndex(indices);geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  tube(-1.24,0,.135,railMat,7);tube(1.24,0,.135,railMat,7);tube(0,-.86,.25,spineMat,6);
  const tieCount=Math.ceil(length/1.55);
  const ties=new THREE.InstancedMesh(new THREE.BoxGeometry(2.94,.19,.32),tieMat,tieCount);
  ties.castShadow=true;ties.receiveShadow=true;root.add(ties);
  const braces=new THREE.InstancedMesh(new THREE.CylinderGeometry(.061,.061,1,5),tieMat,tieCount*2);
  braces.castShadow=true;root.add(braces);
  const yAxis=new THREE.Vector3(0,1,0);
  function beamMatrix(a,b,radius=1) {
    const delta=new THREE.Vector3().subVectors(b,a);
    object.position.copy(a).add(b).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(yAxis,delta.clone().normalize());
    object.scale.set(radius,delta.length(),radius);object.updateMatrix();return object.matrix;
  }
  for(let i=0;i<tieCount;i++) {
    const f=getFrame(i/tieCount*length);
    object.position.copy(f.position).addScaledVector(f.up,-.22);object.quaternion.copy(f.quaternion);object.scale.set(1,1,1);object.updateMatrix();ties.setMatrixAt(i,object.matrix);
    const b=f.position.clone().addScaledVector(f.up,-.83);
    for(let side=0;side<2;side++) {
      const a=f.position.clone().addScaledVector(f.right,side?1.2:-1.2).addScaledVector(f.up,-.18);
      braces.setMatrixAt(i*2+side,beamMatrix(a,b));
    }
  }
  // Supports at grade are kept out of lower, crossing portions of the circuit.
  const supportData=[];
  const supportSpacing=10.5;
  const nearbyLowerTrack=(x,z,top,ownDistance)=> {
    for(let k=0;k<samples.length;k+=3) {
      const sample=samples[k],sampleDistance=k/(samples.length-1)*length;
      let along=Math.abs(sampleDistance-ownDistance);along=Math.min(along,length-along);
      if(along<20)continue;
      if(sample.y<top-3 && Math.hypot(sample.x-x,sample.z-z)<3.2)return true;
    }
    return false;
  };
  for(let d=0;d<length;d+=supportSpacing) {
    const f=getFrame(d),top=f.position.clone().addScaledVector(f.up,-1.13);
    // Ground struts through an inversion would cross the riders' envelope.
    // The loop instead hangs from two external portal frames below.
    if(loopSection&&d>loopSection.start-8&&d<loopSection.end+8)continue;
    if(nearbyLowerTrack(top.x,top.z,top.y,d))continue;
    const span=top.y>28?3.6:2.7;
    // Leaning side braces read as lightweight tubular steel instead of heavy scaffolding.
    const side=new THREE.Vector3(f.right.x,0,f.right.z).normalize();
    const footA=top.clone().addScaledVector(side,span);footA.y=.20;
    const footB=top.clone().addScaledVector(side,-span);footB.y=.20;
    if(!nearbyLowerTrack(footA.x,footA.z,top.y,d))supportData.push({a:footA,b:top.clone(),foot:true});
    if(!nearbyLowerTrack(footB.x,footB.z,top.y,d))supportData.push({a:footB,b:top.clone(),foot:true});
    if(top.y>12) {
      const lower=top.clone();lower.y=top.y*.5;
      const braceA=footA.clone().lerp(top,.48),braceB=footB.clone().lerp(top,.48);
      supportData.push({a:braceA,b:braceB,foot:false});
    }
  }
  if(loopSection) {
    for(const z of [23,47]) {
      const left=new THREE.Vector3(41,63,z),right=new THREE.Vector3(79,63,z);
      supportData.push({a:new THREE.Vector3(41,.2,z),b:left,foot:true});
      supportData.push({a:new THREE.Vector3(79,.2,z),b:right,foot:true});
      supportData.push({a:left,b:right,foot:false});
      let nearest=null,best=Infinity;
      for(let i=0;i<=160;i++) {
        const frame=getFrame(loopSection.start+i/160*(loopSection.end-loopSection.start));
        const delta=Math.abs(frame.position.z-z);
        if(frame.position.y>50&&delta<best){nearest=frame;best=delta;}
      }
      if(nearest) {
        const anchor=nearest.position.clone().addScaledVector(nearest.up,-1.13);
        supportData.push({a:anchor,b:new THREE.Vector3(anchor.x,63,z),foot:false});
      }
    }
  }
  const supports=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.33,1,7),steelMat,supportData.length);
  supports.castShadow=true;supports.receiveShadow=true;root.add(supports);
  const basesData=supportData.filter(d=>d.foot);
  const bases=new THREE.InstancedMesh(new THREE.CylinderGeometry(.73,.92,.48,6),concreteMat,basesData.length);
  bases.receiveShadow=true;root.add(bases);
  const collars=new THREE.InstancedMesh(new THREE.CylinderGeometry(.39,.39,.46,7),tealMat,basesData.length);
  collars.castShadow=true;root.add(collars);
  supportData.forEach((d,i)=>supports.setMatrixAt(i,beamMatrix(d.a,d.b)));
  basesData.forEach((d,i)=> {
    object.position.copy(d.a);object.position.y=.22;object.quaternion.identity();object.scale.set(1,1,1);object.updateMatrix();bases.setMatrixAt(i,object.matrix);
    object.position.copy(d.a).lerp(d.b,.04);object.updateMatrix();collars.setMatrixAt(i,object.matrix);
  });

  function mesh(geometry,material,position,rotation=null) {
    const m=new THREE.Mesh(geometry,material);m.position.set(...position);if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
  }
  const boxBatches=new Map();
  function box(size,material,pos,rot=null) {
    if(!boxBatches.has(material))boxBatches.set(material,[]);
    object.position.set(...pos);object.rotation.set(...(rot||[0,0,0]));object.scale.set(...size);object.updateMatrix();
    boxBatches.get(material).push(object.matrix.clone());
  }
  // Open-sided boarding pavilion, set beside the track so the front view stays clear.
  const stationCream=mat(0xf8eed4), roofMat=mat(new THREE.Color(ride.color).multiplyScalar(.82)), darkMat=mat(0x244d4c), woodMat=mat(0xbd9367,{roughness:.85,metalness:0});
  box([31,5.6,9.4],stationCream,[-47,2.8,71.4]);
  box([31.5,.30,10],woodMat,[-47,5.75,71.2]);
  box([31,.22,1.25],tealMat,[-47,5.96,66.8]);
  for(let x=-61;x<=-33;x+=7) {
    box([.38,7.35,.38],tealMat,[x,9.6,76.0]);
    box([.32,7.35,.32],tealMat,[x,9.6,66.8]);
    box([.4,5.5,.4],darkMat,[x,2.75,75.8]);
  }
  box([32,.35,11.6],roofMat,[-47,13.35,71.3]);
  box([32,.55,.22],stationCream,[-47,13.1,65.55]);
  box([32,.55,.22],stationCream,[-47,13.1,77.05]);
  // Subtle raised canopy fins and individual deck seams make the station feel built.
  for(let x=-62;x<=-32;x+=2)box([.11,.16,11.6],stationCream,[x,13.59,71.3]);
  for(let x=-61;x<=-33;x+=1.0)box([.04,.025,8.8],stationCream,[x,5.915,71.3]);
  for(let x=-61;x<=-33;x+=2.25) {
    box([.13,1.2,.13],tealMat,[x,6.7,76.1]);
    box([2.25,.12,.13],tealMat,[x+1.1,7.24,76.1]);
  }
  // Platform stairs and handrails.
  for(let i=0;i<12;i++) box([6,(12-i)*.47,1.1],stationCream,[-47,(12-i)*.47/2,77.1+i*.75]);
  const handrailMaterial=tealMat;
  for(const x of [-50.1,-43.9]) {
    const a=new THREE.Vector3(x,6.9,77),b=new THREE.Vector3(x,1.1,86);
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,1,6),handrailMaterial);rail.matrix.copy(beamMatrix(a,b));rail.matrixAutoUpdate=false;root.add(rail);
  }
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#f7ecd2';ctx.fillRect(0,0,1024,192);
    ctx.fillStyle='#275956';ctx.font='900 86px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ride.name.toUpperCase(),512,102,960);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(12.4,2.32),new THREE.MeshStandardMaterial({map:texture,roughness:.8,side:THREE.DoubleSide}));sign.position.set(-47,12.1,77.13);root.add(sign);
  }
  // Chain-lift rides carry a walkway. The launched ride has magnetic fins.
  const liftSection=sections.find(section=>section.type==='lift');
  if(liftSection) {
  const {start:stationEnd,end:crest}=liftSection;
  const chainCount=Math.ceil((crest-stationEnd)/1.7);
  const chain=new THREE.InstancedMesh(new THREE.BoxGeometry(.29,.19,.65),darkMat,chainCount);
  const walkway=new THREE.InstancedMesh(new THREE.BoxGeometry(.9,.12,1.7),steelMat,chainCount);
  const safety=new THREE.InstancedMesh(new THREE.CylinderGeometry(.046,.046,1.05,5),steelMat,Math.ceil(chainCount/2));
  root.add(chain,walkway,safety);let safetyIndex=0;
  for(let i=0;i<chainCount;i++) {
    const f=getFrame(stationEnd+(i+.5)/chainCount*(crest-stationEnd));
    object.position.copy(f.position).addScaledVector(f.up,.08);object.quaternion.copy(f.quaternion);object.scale.set(1,1,1);object.updateMatrix();chain.setMatrixAt(i,object.matrix);
    object.position.copy(f.position).addScaledVector(f.right,2.15).addScaledVector(f.up,-.2);object.updateMatrix();walkway.setMatrixAt(i,object.matrix);
    if(i%2===0){object.position.addScaledVector(f.right,.4).addScaledVector(f.up,.52);object.updateMatrix();safety.setMatrixAt(safetyIndex++,object.matrix);}
  }
  // Curved handrail follows the lift without more per-object meshes.
  const handrailPoints=[];
  for(let i=0;i<=160;i++){const f=getFrame(stationEnd+i/160*(crest-stationEnd));handrailPoints.push(f.position.addScaledVector(f.right,2.55).addScaledVector(f.up,.85));}
  const handrailCurve=new THREE.CatmullRomCurve3(handrailPoints);
  const handrail=new THREE.Mesh(new THREE.TubeGeometry(handrailCurve,180,.045,5,false),steelMat);root.add(handrail);
  }
  const launchSection=sections.find(section=>section.type==='launch');
  if(launchSection) {
    const count=Math.ceil((launchSection.end-launchSection.start)/2.8);
    const fins=new THREE.InstancedMesh(new THREE.BoxGeometry(.64,.20,1.8),tealMat,count);
    fins.name='Magnetic launch fins';root.add(fins);
    for(let i=0;i<count;i++) {
      const frame=getFrame(launchSection.start+(i+.5)/count*(launchSection.end-launchSection.start));
      object.position.copy(frame.position).addScaledVector(frame.up,.08);
      object.quaternion.copy(frame.quaternion);object.scale.set(1,1,1);object.updateMatrix();fins.setMatrixAt(i,object.matrix);
    }
  }
  for(const [material,matrices] of boxBatches) {
    const batch=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,matrices.length);
    matrices.forEach((matrix,index)=>batch.setMatrixAt(index,matrix));batch.castShadow=true;batch.receiveShadow=true;root.add(batch);
  }
  root.userData.trackLength=length;
  root.userData.rideId=ride.id;
  let disposed=false;
  function dispose() {
    if(disposed)return;
    disposed=true;
    root.removeFromParent();
    const geometries=new Set(),materials=new Set(),textures=new Set();
    root.traverse(object=>{
      if(object.isInstancedMesh)object.dispose();
      if(object.geometry)geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(material);
    });
    for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    for(const texture of textures)texture.dispose();
    for(const geometry of geometries)geometry.dispose();
    for(const material of materials)material.dispose();
    root.clear();
  }
  return {curve,length,samples,getFrame,sections,featureZones,root,ride,dispose};
}
