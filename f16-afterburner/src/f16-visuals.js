/* F-16 Language Flight — original procedural geometry and scenery. */
(function () {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6d2b79f5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function createJet(T, options) {
    options = options || {};
    var g = new T.Group(), low = !!options.enemy, segments = low ? 16 : 36;
    var body = new T.MeshStandardMaterial({color: options.body == null ? 0xa6b5b9 : options.body, metalness:.55, roughness:.32});
    var wing = new T.MeshStandardMaterial({color: options.wing == null ? 0x849a9e : options.wing, metalness:.5, roughness:.37});
    var dark = new T.MeshStandardMaterial({color:0x24383e, metalness:.54, roughness:.35});
    var black = new T.MeshStandardMaterial({color:0x10191f,metalness:.35,roughness:.46});
    var accent = new T.MeshStandardMaterial({color: options.enemy ? 0xd65c49 : 0xf1bf69,metalness:.35,roughness:.3});
    var nozzle = new T.MeshStandardMaterial({color:0x4a4744,metalness:.88,roughness:.3});
    var lineMat = new T.LineBasicMaterial({color:0x3b5158,transparent:true,opacity:.54});
    function add(geo, mat, x,y,z) { var m = new T.Mesh(geo,mat); m.position.set(x||0,y||0,z||0); g.add(m); return m; }
    function surface(profiles,mat) {
      var curve = new T.CatmullRomCurve3(profiles.map(function(p){return new T.Vector3(p[1],p[2],p[0]);}),false,'centripetal');
      var samples = low ? profiles.length*2 : profiles.length*5, verts=[], uvs=[], indices=[];
      for(var i=0;i<=samples;i++) {var p=curve.getPoint(i/samples); for(var j=0;j<=segments;j++){var a=j/segments*Math.PI*2;verts.push(Math.max(.003,p.x)*Math.cos(a),Math.max(.003,p.y)*Math.sin(a),p.z);uvs.push(j/segments,i/samples);}}
      for(var r=0;r<samples;r++) for(var k=0;k<segments;k++){var a=r*(segments+1)+k,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
      var geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return add(geo,mat);
    }
    surface([[-6.65,.49,.49],[-5.8,.64,.58],[-4.6,.76,.63],[-2.4,.79,.68],[0,.75,.64],[2.2,.62,.55],[4.6,.44,.39],[5.05,.37,.34]],body);
    surface([[5.05,.369,.339],[5.7,.30,.29],[6.4,.21,.22],[7.1,.105,.14],[7.72,.015,.025],[7.85,.003,.003]],new T.MeshStandardMaterial({color:0x7f9499,metalness:.35,roughness:.39}));
    // Swept, tapered airfoil outlines: a shallow thickness, with no box wings.
    function slab(points, thickness, mat, plane, offset) {
      var pts=points.map(function(p){return new T.Vector2(p[0],p[1]);}), tris=T.ShapeUtils.triangulateShape(pts,[]), pos=[],ind=[];
      var n=points.length; for(var face=0;face<2;face++)for(var i=0;i<n;i++){var p=points[i], h=(face?1:-1)*thickness/2+(offset||0);if(plane==='yz')pos.push(h,p[0],p[1]);else pos.push(p[0],h,p[1]);}
      tris.forEach(function(t){ind.push(t[2],t[1],t[0],t[0]+n,t[1]+n,t[2]+n);});
      for(var j=0;j<n;j++){var k=(j+1)%n;ind.push(j,k,k+n,j,k+n,j+n);}
      var geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(ind);geo.computeVertexNormals();var m=add(geo,mat);m.material.side=T.DoubleSide;return m;
    }
    [-1,1].forEach(function(side){
      slab([[.53*side,2.3],[1.0*side,1.7],[5.05*side,-.85],[5.13*side,-2.0],[1.0*side,-2.65],[.55*side,-1.4]],.115,wing,'xz',-.06);
      slab([[.5*side,3.5],[1.0*side,2.05],[1.35*side,-.4],[.55*side,-1.0]],.12,body,'xz',.02);
      slab([[.45*side,-3.15],[2.65*side,-4.4],[2.91*side,-5.65],[.45*side,-5.48]],.1,wing,'xz',.06);
      slab([[-.37,-3.4],[-1.28,-4.48],[-1.32,-5.7],[-.4,-5.3]],.065,dark,'yz',side*.47);
      var rail=add(new T.CylinderGeometry(.07,.07,2.25,8),dark,5.03*side,-.08,-1.29);rail.rotation.x=Math.PI/2;
      var nav=add(new T.SphereGeometry(.07,8,6),new T.MeshBasicMaterial({color:side<0?0xff3d32:0x7dffc2}),side*5.12,.02,-1.12);
      if(!low){
        // Wingtip training missiles, pylons, and flush control surface seams.
        var pylon=add(new T.BoxGeometry(.1,.4,.92),dark,side*2.2,-.28,-.65);
        var store=add(new T.CylinderGeometry(.105,.15,2.75,12),body,side*2.2,-.64,-.52);store.rotation.x=Math.PI/2;
        var tip=add(new T.ConeGeometry(.105,.7,12),accent,side*2.2,-.64,1.2);tip.rotation.x=Math.PI/2;
        var lines=[new T.Vector3(side*1.05,.009,-1.9),new T.Vector3(side*4.7,.009,-1.4),new T.Vector3(side*4.75,.009,-1.96),new T.Vector3(side*1.1,.009,-2.56)];
        g.add(new T.Line(new T.BufferGeometry().setFromPoints(lines),lineMat));
        var seam=[new T.Vector3(side*.7,.125,-4.7),new T.Vector3(side*2.57,.125,-5.17)];g.add(new T.Line(new T.BufferGeometry().setFromPoints(seam),lineMat));
        // Identification stripe along wing leading edge.
        slab([[side*3.92,-.18],[side*4.64,-.63],[side*4.64,-.84],[side*3.92,-.39]],.013,accent,'xz',.012);
      }
    });
    slab([[.35,-3.0],[1.1,-3.68],[3.02,-4.95],[3.02,-6.14],[.35,-6.23]],.16,wing,'yz');
    slab([[2.57,-4.68],[3.025,-4.95],[3.025,-6.14],[2.57,-6.15]],.174,accent,'yz');
    var spine=add(new T.SphereGeometry(1,segments,12),body,0,.45,-2.4);spine.scale.set(.38,.35,2.55);
    // Intake lip, recessed dark throat, and smoothly blended lower duct.
    var duct=add(new T.SphereGeometry(1,segments,14),body,0,-.52,.8);duct.scale.set(.55,.48,1.95);
    var throat=add(new T.CircleGeometry(.435,segments),black,0,-.56,2.66);throat.scale.set(1,.78,1);
    var lip=add(new T.TorusGeometry(.44,.045,8,segments),body,0,-.56,2.68);lip.scale.y=.8;
    var splitter=add(new T.BoxGeometry(.83,.07,.34),dark,0,-.205,2.63);
    // Bronze one-piece canopy, a visible seat and helmet beneath it.
    var seat=add(new T.BoxGeometry(.42,.45,.56),black,0,.61,2.5);seat.rotation.x=.12;
    var pilot=add(new T.SphereGeometry(.17,12,8),dark,0,.93,2.75);pilot.scale.set(.82,1,.9);
    var visor=add(new T.SphereGeometry(.17,12,8),black,0,.94,2.82);visor.scale.set(.83,.45,.8);
    var glass = new T.MeshPhysicalMaterial({color:0x92947a,metalness:.43,roughness:.12,emissive:0x4d4122,emissiveIntensity:.24,clearcoat:1,clearcoatRoughness:.07,transparent:true,opacity:.74,side:T.FrontSide});
    var canopy=add(new T.SphereGeometry(1,low?16:36,low?10:22),glass,0,.63,2.8);canopy.scale.set(.53,.68,1.68);
    var rim=[];for(var c=0;c<=64;c++){var a=c/64*Math.PI*2;rim.push(new T.Vector3(Math.cos(a)*.535,.63,2.8+Math.sin(a)*1.69));}g.add(new T.Line(new T.BufferGeometry().setFromPoints(rim),new T.LineBasicMaterial({color:0x24383e})));
    if(!low){
      var wind=[];for(var v=0;v<=30;v++){var a=v/30*Math.PI;wind.push(new T.Vector3(Math.cos(a)*.42,.63+Math.sin(a)*.54,3.85));}g.add(new T.Line(new T.BufferGeometry().setFromPoints(wind),lineMat));
      // Panel rings and dorsal maintenance lines.
      [5.04,-5.8].forEach(function(z){var r=z>0?.372:.64, ry=z>0?.342:.583,pts=[];for(var j=0;j<=64;j++){var a=j/64*Math.PI*2;pts.push(new T.Vector3(r*Math.cos(a),ry*Math.sin(a),z));}g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat));});
      [-1,1].forEach(function(s){var pts=[new T.Vector3(s*.54,.36,2),new T.Vector3(s*.68,.38,0),new T.Vector3(s*.68,.34,-3.8)];g.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),lineMat));});
      var decal=document.createElement('canvas');decal.width=256;decal.height=256;var dc=decal.getContext('2d');dc.clearRect(0,0,256,256);dc.fillStyle='#1d353c';dc.textAlign='center';dc.font='bold 110px sans-serif';dc.fillText('16',128,152);dc.font='bold 24px sans-serif';dc.fillText('GO LINGO',128,202);var tex=new T.CanvasTexture(decal);tex.colorSpace=T.SRGBColorSpace;
      [-1,1].forEach(function(s){var m=add(new T.PlaneGeometry(1.12,1.12),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide}),s*.091,1.75,-5.36);m.rotation.y=s*Math.PI/2;});
    }
    var exhaust=add(new T.CylinderGeometry(.49,.60,.75,segments,1,true),nozzle,0,0,-6.34);exhaust.rotation.x=Math.PI/2;
    var hot=add(new T.CircleGeometry(.46,segments),new T.MeshBasicMaterial({color:0xffb95c}),0,0,-6.73);hot.rotation.y=Math.PI;
    var flameMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,uniforms:{uTime:{value:0},uBoost:{value:0}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float uTime;uniform float uBoost;void main(){float t=vUv.y;float flick=.8+.2*sin(t*55.-uTime*32.);float alpha=pow(1.-t,0.7)*(.35+.25*uBoost)*flick;vec3 col=mix(vec3(.2,.52,1.),vec3(1.,.5,.14),smoothstep(.15,.8,t));gl_FragColor=vec4(col,alpha);}' });
    var flame=add(new T.ConeGeometry(.48,3.8,segments,1,true),flameMat,0,0,-8.55);flame.rotation.x=-Math.PI/2;
    var core=add(new T.ConeGeometry(.28,2.6,segments,1,true),new T.MeshBasicMaterial({color:0xb9dcff,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}),0,0,-8);core.rotation.x=-Math.PI/2;
    var light=new T.PointLight(0xffb15b,low?0:2.2,14,2);light.position.z=-6.8;if(!low)g.add(light);
    g.userData.flame=flame;g.userData.core=core;g.userData.light=light;
    g.userData.update=function(dt,time,boost){var b=boost?1:0;var len=(b?1.2:.38)*(1+.04*Math.sin(time*43));flame.scale.set(1,len,1);flame.position.z=-6.7-1.9*len;core.scale.setScalar(b?1:.5);core.position.z=-6.72-1.3*(b?1:.5);flameMat.uniforms.uTime.value=time;flameMat.uniforms.uBoost.value=b;light.intensity=b?4:1.4;};
    g.name=options.enemy?'Interceptor':'F-16 Falcon';return g;
  }
  function createWorld(T, scene) {
    var rand=rng(42), time=0;
    var sunDir=new T.Vector3(-.43,.28,.86).normalize();
    scene.fog=new T.FogExp2(0xa8c3c8,.000065);
    scene.add(new T.HemisphereLight(0xd7eeff,0x4b6357,2.0));
    var sun=new T.DirectionalLight(0xffd6a6,3.1);sun.position.copy(sunDir).multiplyScalar(8000);scene.add(sun);
    var fill=new T.DirectionalLight(0x94cbe6,.65);fill.position.set(400,160,-900);scene.add(fill);
    var sky=new T.Mesh(new T.SphereGeometry(26000,32,20),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uSun:{value:sunDir}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;uniform vec3 uSun;void main(){vec3 p=normalize(vP);float h=p.y;vec3 col=mix(vec3(.66,.79,.84),vec3(.09,.34,.59),smoothstep(-.04,.50,h));float sd=max(0.,dot(p,uSun));col=mix(col,vec3(1.,.73,.44),pow(sd,7.)*.3);col+=vec3(1.,.58,.20)*pow(sd,30.)*.22;col+=vec3(3.,2.1,1.1)*smoothstep(.99945,.9998,sd);gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' .replace(';#include',';\n#include')}));sky.renderOrder=-10;scene.add(sky);
    // Large islands bracket a generous, continuous training corridor.
    var islands=[
      {x:-2200,z:1800,rx:1350,rz:2050,h:780,s:1},
      {x:2050,z:3100,rx:1250,rz:1800,h:970,s:5},
      {x:-2700,z:6800,rx:1700,rz:2300,h:1350,s:9},
      {x:2700,z:9000,rx:1700,rz:2450,h:1200,s:15},
      {x:-6000,z:10600,rx:2300,rz:3200,h:1700,s:19},
      {x:5900,z:5000,rx:2250,rz:3100,h:1600,s:23},
      {x:-1250,z:-1700,rx:420,rz:1060,h:30,s:29,flat:true},
      {x:-3100,z:-4200,rx:2300,rz:2300,h:1300,s:33},
      {x:600,z:15300,rx:1750,rz:2600,h:1550,s:41},
      {x:-9000,z:2500,rx:2300,rz:3000,h:1650,s:48},
      {x:8400,z:12300,rx:2200,rz:2600,h:1800,s:52},
      {x:-4300,z:17000,rx:2600,rz:2300,h:1600,s:58}
    ];
    function hash(x,z){var n=Math.sin(x*127.1+z*311.7)*43758.5453123;return n-Math.floor(n);}
    function noise(x,z){var ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;fx=fx*fx*(3-2*fx);fz=fz*fz*(3-2*fz);return (hash(ix,iz)*(1-fx)+hash(ix+1,iz)*fx)*(1-fz)+(hash(ix,iz+1)*(1-fx)+hash(ix+1,iz+1)*fx)*fz;}
    function fbm(x,z){return noise(x,z)*.56+noise(x*2.04+13,z*2.03-17)*.26+noise(x*4.11-11,z*4.07+3)*.12+noise(x*8.2,z*8.2)*.06;}
    function islandHeight(it,x,z){var nx=(x-it.x)/it.rx,nz=(z-it.z)/it.rz,r=Math.sqrt(nx*nx+nz*nz),angle=Math.atan2(nz,nx);var edge=1+.10*Math.sin(angle*5+it.s)+.06*Math.sin(angle*9-it.s);var q=r/edge;if(q>1.08)return -14;if(it.flat){var f=Math.max(0,Math.min(1,(q-.70)/.38));return 28-f*f*(3.-2.*f)*42;}var inland=Math.max(0,1-q);var ridges=fbm(nx*4.2+it.s,nz*4.2-it.s),ox=nx+.13*Math.sin(nz*3+it.s),oz=nz+.08*Math.sin(nx*4-it.s);var r1=Math.exp(-((ox+.14)*(ox+.14)*2.6+(oz-.18)*(oz-.18)*1.1)*3.2),r2=.83*Math.exp(-((ox-.3)*(ox-.3)*1.1+(oz+.28)*(oz+.28)*2.8)*4),r3=.68*Math.exp(-((ox+.44)*(ox+.44)*2+(oz+.4)*(oz+.4)*1.2)*5);var edgeRise=Math.min(1,inland/.30);edgeRise=edgeRise*edgeRise*(3-2*edgeRise);return edgeRise*(.07+Math.max(r1,r2,r3)*.85)*it.h*(.58+.80*ridges)-12;}
    function heightAt(x,z){var h=0;for(var i=0;i<islands.length;i++){var it=islands[i];if(Math.abs(x-it.x)<it.rx*1.2&&Math.abs(z-it.z)<it.rz*1.2)h=Math.max(h,islandHeight(it,x,z));}return h;}
    var terrainMat=new T.MeshStandardMaterial({vertexColors:true,metalness:0,roughness:1});
    var sand=new T.Color(0xe0cc9c),lowGrass=new T.Color(0x456c51),grass=new T.Color(0x47674b),rock=new T.Color(0x8c8c7b),summit=new T.Color(0xbcc0ad),col=new T.Color();
    islands.forEach(function(it,index){
      var n=index<4?84:64,geo=new T.PlaneGeometry(it.rx*2.3,it.rz*2.3,n,n);geo.rotateX(-Math.PI/2);var pos=geo.attributes.position,colors=[];
      for(var k=0;k<pos.count;k++){var x=pos.getX(k)+it.x,z=pos.getZ(k)+it.z,h=islandHeight(it,x,z);pos.setXYZ(k,x,h,z);var sx=(islandHeight(it,x+18,z)-islandHeight(it,x-18,z))/36,sz=(islandHeight(it,x,z+18)-islandHeight(it,x,z-18))/36,slope=Math.sqrt(sx*sx+sz*sz);if(h<24)col.copy(sand);else{col.copy(lowGrass).lerp(grass,Math.min(1,h/500));col.lerp(rock,Math.min(1,Math.max(0,slope-.44)*1.3));if(h>800)col.lerp(summit,Math.min(.65,(h-800)/1300));}var v=.86+fbm(x*.013,z*.013)*.24;col.multiplyScalar(v);colors.push(col.r,col.g,col.b);}
      geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();var m=new T.Mesh(geo,terrainMat);scene.add(m);
    });
    var oceanMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uSun:{value:sunDir},uIslands:{value:islands.map(function(it){return new T.Vector4(it.x,it.z,it.rx,it.rz);})}},vertexShader:'uniform float uTime;varying vec3 vWorld;void main(){vec3 p=position;p.y=sin(p.x*.008+uTime*.48)*1.4+sin(p.z*.011+uTime*.37)*.8;vec4 w=modelMatrix*vec4(p,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',fragmentShader:[
      'uniform float uTime;uniform vec3 uSun;uniform vec4 uIslands[12];varying vec3 vWorld;',
      'float ripple(vec2 p){return sin(p.x*.025+p.y*.017+sin(p.y*.006)*1.8+uTime*.9)*.68+sin(p.x*.071-p.y*.051+sin(p.x*.012)*2.-uTime*.75)*.16+sin(p.x*.21+p.y*.16+sin(p.y*.047)*1.4+uTime*1.6)*.035;}',
      'void main(){vec3 V=normalize(cameraPosition-vWorld);vec2 p=vWorld.xz;float e=1.4;float dx=(ripple(p+vec2(e,0.))-ripple(p-vec2(e,0.)))/(e*2.);float dz=(ripple(p+vec2(0.,e))-ripple(p-vec2(0.,e)))/(e*2.);vec3 N=normalize(vec3(-dx,1.,-dz));float fres=pow(1.-max(0.,dot(N,V)),4.);float coast=10.;for(int i=0;i<12;i++){vec2 rel=(p-uIslands[i].xy)/uIslands[i].zw;coast=min(coast,length(rel)-1.);}float shallow=1.-smoothstep(-.1,.38,coast);vec3 water=mix(vec3(.027,.205,.265),vec3(.055,.44,.43),shallow*.67);vec3 reflected=vec3(.38,.60,.68);vec3 col=mix(water,reflected,fres*.68);vec3 H=normalize(V+uSun);float spec=pow(max(0.,dot(N,H)),350.);col+=vec3(1.,.79,.45)*spec*1.9;float longGlint=pow(max(0.,dot(reflect(-uSun,N),V)),35.);col+=vec3(.6,.39,.15)*longGlint*.13;float foam=(1.-smoothstep(.001,.03,abs(coast+.03)))*(.55+.45*sin(p.x*.045+sin(p.y*.05)*2.-uTime));col=mix(col,vec3(.71,.84,.78),max(0.,foam)*.32);float fog=1.-exp(-length(cameraPosition-vWorld)*.00007);col=mix(col,vec3(.48,.65,.70),fog);gl_FragColor=vec4(col,1.);',
      '#include <tonemapping_fragment>','#include <colorspace_fragment>','}'
    ].join('\n')});
    var oceanGeo=new T.PlaneGeometry(65000,65000,190,190);oceanGeo.rotateX(-Math.PI/2);var ocean=new T.Mesh(oceanGeo,oceanMat);scene.add(ocean);
    // Dense woodland gives the slopes scale, with only two draw calls.
    var forestPositions=[],dummy=new T.Object3D();
    for(var itn=0;itn<8;itn++){var it=islands[itn];for(var attempt=0;attempt<260;attempt++){var x=it.x+(rand()-.5)*it.rx*1.8,z=it.z+(rand()-.5)*it.rz*1.8,h=islandHeight(it,x,z);if(h<35||h>630)continue;var dh=Math.abs(islandHeight(it,x+15,z)-h)+Math.abs(islandHeight(it,x,z+15)-h);if(dh>26)continue;forestPositions.push({x:x,y:h,z:z,s:8+rand()*11});}}
    var trees=new T.InstancedMesh(new T.ConeGeometry(1,2.5,6),new T.MeshStandardMaterial({color:0x275341,roughness:1}),forestPositions.length);
    var crowns=new T.InstancedMesh(new T.ConeGeometry(.74,2.1,6),new T.MeshStandardMaterial({color:0x38634a,roughness:1}),forestPositions.length);
    forestPositions.forEach(function(p,i){dummy.position.set(p.x,p.y+p.s,p.z);dummy.rotation.set(0,rand()*6.28,0);dummy.scale.set(p.s*.62,p.s,p.s*.62);dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);dummy.position.y+=p.s*.55;dummy.updateMatrix();crowns.setMatrixAt(i,dummy.matrix);});scene.add(trees,crowns);
    // Soft billowing cloud sprites stay far overhead and use one instanced draw call.
    var cloudCanvas=document.createElement('canvas');cloudCanvas.width=512;cloudCanvas.height=256;var cc=cloudCanvas.getContext('2d');
    for(var cp=0;cp<62;cp++){var cx=75+rand()*360,cy=155-Math.sin((cx-75)/360*Math.PI)*65+(rand()-.5)*36,cr=24+rand()*42;var grad=cc.createRadialGradient(cx,cy,cr*.16,cx,cy,cr);grad.addColorStop(0,'rgba(255,248,231,.52)');grad.addColorStop(.52,'rgba(245,242,228,.43)');grad.addColorStop(1,'rgba(231,239,234,0)');cc.fillStyle=grad;cc.fillRect(cx-cr,cy-cr,cr*2,cr*2);}
    var ct=new T.CanvasTexture(cloudCanvas);ct.colorSpace=T.SRGBColorSpace;
    var cloudMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uMap:{value:ct}},vertexShader:'varying vec2 vUv;varying float vDistance;void main(){vUv=uv;vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);vDistance=length(center.xyz);vec2 size=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));center.xy+=position.xy*size;gl_Position=projectionMatrix*center;}',fragmentShader:'uniform sampler2D uMap;varying vec2 vUv;varying float vDistance;void main(){vec4 c=texture2D(uMap,vUv);float shade=.82+.18*smoothstep(.2,.7,vUv.y);vec3 col=vec3(.98,.96,.89)*shade;float fog=1.-exp(-vDistance*.000035);col=mix(col,vec3(.71,.81,.84),fog);gl_FragColor=vec4(col,c.a*.85);}' });
    var cloudCount=42,clouds=new T.InstancedMesh(new T.PlaneGeometry(1,1),cloudMat,cloudCount);
    for(var ci=0;ci<cloudCount;ci++){dummy.position.set((rand()-.5)*23000,2300+rand()*1300,(rand()-.3)*27000);dummy.rotation.set(0,0,0);var size=1100+rand()*1200;dummy.scale.set(size,size*.42,1);dummy.updateMatrix();clouds.setMatrixAt(ci,dummy.matrix);}clouds.frustumCulled=false;scene.add(clouds);
    // Coastal airfield landmark on an island shelf, away from the flight path.
    var airfield=new T.Group();airfield.position.set(-1250,34,-1700);
    var platform=new T.Mesh(new T.BoxGeometry(310,50,1050),new T.MeshStandardMaterial({color:0x6a755f,roughness:1}));platform.position.y=-31;airfield.add(platform);
    var runway=new T.Mesh(new T.PlaneGeometry(70,930),new T.MeshStandardMaterial({color:0x414c4d,roughness:.88}));runway.rotation.x=-Math.PI/2;runway.position.y=-5.7;airfield.add(runway);
    var markings=new T.InstancedMesh(new T.PlaneGeometry(3,35),new T.MeshBasicMaterial({color:0xe5e4ce}),18);for(var i=0;i<18;i++){dummy.position.set(0,-5.5,-420+i*48);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();markings.setMatrixAt(i,dummy.matrix);}airfield.add(markings);
    var hangMat=new T.MeshStandardMaterial({color:0xacb8b1,roughness:.7,metalness:.2});for(var h=0;h<4;h++){var hang=new T.Mesh(new T.BoxGeometry(60,32,85),hangMat);hang.position.set(-92,10,-290+h*170);airfield.add(hang);var roof=new T.Mesh(new T.CylinderGeometry(30,30,85,12,1,false,0,Math.PI),hangMat);roof.rotation.x=Math.PI/2;roof.position.set(-92,25,-290+h*170);airfield.add(roof);}
    var tower=new T.Mesh(new T.CylinderGeometry(10,14,67,8),hangMat);tower.position.set(99,27,280);airfield.add(tower);var cab=new T.Mesh(new T.CylinderGeometry(20,16,13,8),new T.MeshStandardMaterial({color:0x345463,metalness:.55,roughness:.2}));cab.position.set(99,64,280);airfield.add(cab);scene.add(airfield);
    return {heightAt:heightAt,waterLevel:0,update:function(dt,t,playerPosition){time=t; oceanMat.uniforms.uTime.value=t; if(playerPosition)sky.position.copy(playerPosition);clouds.position.x=Math.sin(t*.006)*90;},islands:islands};
  }
  function createShip(T){
    var g=new T.Group(),hullMat=new T.MeshStandardMaterial({color:0x56656a,metalness:.45,roughness:.5}),deckMat=new T.MeshStandardMaterial({color:0x7b8987,metalness:.35,roughness:.6}),dark=new T.MeshStandardMaterial({color:0x273942,metalness:.4,roughness:.5});
    function box(w,h,d,x,y,z,mat){var m=new T.Mesh(new T.BoxGeometry(w,h,d),mat||deckMat);m.position.set(x,y,z);g.add(m);return m;}
    var shape=new T.Shape();shape.moveTo(-8,-29);shape.lineTo(8,-29);shape.lineTo(10,11);shape.quadraticCurveTo(8,27,0,37);shape.quadraticCurveTo(-8,27,-10,11);shape.closePath();var geo=new T.ExtrudeGeometry(shape,{depth:6,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:1.2,bevelThickness:1});geo.rotateX(Math.PI/2);var hull=new T.Mesh(geo,hullMat);hull.position.y=7;g.add(hull);
    box(11,5,19,0,9,-6);box(8,5,11,0,14,-6);box(10,2.8,8,0,17.5,-4,dark);box(4,5,5,0,19,-11);box(1,17,1,0,24,-4,dark);box(12,.6,1,0,30,-4,dark);var radar=new T.Mesh(new T.CylinderGeometry(4,4,.7,16),dark);radar.position.set(0,33,-4);g.add(radar);
    [-1,1].forEach(function(s){box(1,1,26,s*7,7,-7,dark);});
    box(4,3,5,0,9,18);var barrel=new T.Mesh(new T.CylinderGeometry(.32,.45,8,10),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(0,10,23);g.add(barrel);
    var pts=[];[-1,1].forEach(function(s){for(var z=-26;z<=22;z+=6){pts.push(new T.Vector3(s*8,7,z),new T.Vector3(s*8,9,z));}pts.push(new T.Vector3(s*8,9,-26),new T.Vector3(s*8,9,22));});g.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xa7b7b4})));g.scale.setScalar(1.4);return g;
  }
  window.F16Visuals={createJet:createJet,createWorld:createWorld,createShip:createShip};
})();
