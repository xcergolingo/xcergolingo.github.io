import * as THREE from 'three';
import {groundHeight} from './course.js';
import {label} from './world.js';

// Course equipment matches the reference: lean cyan/magenta safety nets,
// ground-conforming rails and clear arrows showing the open side.
export function buildObstacles(scene,challenge){
 const group=new THREE.Group();scene.add(group);
 const boxGeo=new THREE.BoxGeometry(1,1,1),carbon=new THREE.MeshStandardMaterial({color:0x142235,roughness:.8});
 const colors=[0x41dce8,0xdd51c8],glows=colors.map(color=>new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.8,roughness:.4}));
 const nets=colors.map(color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false}));
 function add(root,geometry,material,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);root.add(m);return m;}
 function conform(o,h,d){const g=new THREE.BoxGeometry(o.half*2,h,d,16,1,1),p=g.attributes.position,base=groundHeight(o.x,o.s);for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+groundHeight(o.x+p.getX(i),o.s)-base);g.computeVertexNormals();return g;}
 const items=challenge.obstacles.map(o=>{
  const root=new THREE.Group(),index=o.side<0?0:1;root.position.set(o.x,groundHeight(o.x,o.s),-o.s);group.add(root);
  add(root,conform(o,1.1,.035),nets[index],0,.75,0);
  add(root,conform(o,.055,.08),glows[index],0,1.32,.06);add(root,conform(o,.035,.06),glows[index],0,.2,.06);
  for(const side of [-1,1]){const x=side*o.half,dy=groundHeight(o.x+x,o.s)-root.position.y;add(root,boxGeo,carbon,x,.8+dy,0,.09,1.6,.12);add(root,boxGeo,glows[index],x,1.46+dy,.08,.15,.14,.15);}
  const arrow=label(o.side<0?'→':'←',o.side<0?'#a4f7fa':'#f4b1e6');arrow.position.set(-o.side*(o.half-.9),2.25,.1);arrow.scale.set(2.5,1.2,1);root.add(arrow);
  return {root,arrow,o};
 });
 return {
  update(time,p,glow){for(const m of glows)m.emissiveIntensity=2.4*glow;for(const {root,arrow,o}of items){const distance=o.s-p.s;root.visible=distance>-45&&distance<420;arrow.visible=!o.passed&&distance<125;}},
  dispose(){const geos=new Set([boxGeo]),mats=new Set([carbon,...glows,...nets]),maps=new Set();group.traverse(o=>{if(o.geometry&&!o.isSprite)geos.add(o.geometry);if(o.material){mats.add(o.material);if(o.material.map)maps.add(o.material.map);}});for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of maps)t.dispose();group.removeFromParent();}
 };
}
