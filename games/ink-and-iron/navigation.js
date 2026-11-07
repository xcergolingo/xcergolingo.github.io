// Shared ground flow field: a whole robot must fit past cover and lamp bases.
export function createNavigation(bounds, colliders) {
  const cell=.75, gridRadius=.65, clearance=.62, bodyRadius=.57;
  const minX=bounds.minX+gridRadius,minZ=bounds.minZ+gridRadius;
  const nx=Math.floor((bounds.maxX-gridRadius-minX)/cell)+1,nz=Math.floor((bounds.maxZ-gridRadius-minZ)/cell)+1;
  const blocked=new Uint8Array(nx*nz),distance=new Float64Array(nx*nz);
  const center=(x,z)=>({x:minX+x*cell,z:minZ+z*cell});
  const cellOf=(x,z)=>({x:Math.max(0,Math.min(nx-1,Math.round((x-minX)/cell))),z:Math.max(0,Math.min(nz-1,Math.round((z-minZ)/cell)))});
  const adjacent=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[-1,-1,Math.SQRT2]];
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const p=center(x,z);blocked[z*nx+x]=colliders.some(b=>p.x>b.minX-gridRadius&&p.x<b.maxX+gridRadius&&p.z>b.minZ-gridRadius&&p.z<b.maxZ+gridRadius)?1:0;}
  function hasClearPath(from,to){
    const dx=to.x-from.x,dz=to.z-from.z;
    for(const b of colliders){
      const x0=b.minX-clearance,x1=b.maxX+clearance,z0=b.minZ-clearance,z1=b.maxZ+clearance;
      // A collision can leave the center inside the extra .05 safety padding.
      // Allow it to leave that padding instead of trapping a touching robot.
      if(from.x>x0&&from.x<x1&&from.z>z0&&from.z<z1){
        const slack=clearance-bodyRadius+1e-6;
        if((from.x<=x0+slack&&dx<=0)||(from.x>=x1-slack&&dx>=0)||(from.z<=z0+slack&&dz<=0)||(from.z>=z1-slack&&dz>=0))continue;
      }
      let near=0,far=1,miss=false;
      for(const [p,d,lo,hi]of [[from.x,dx,x0,x1],[from.z,dz,z0,z1]]){
        if(Math.abs(d)<1e-9){if(p<=lo||p>=hi){miss=true;break;}}
        else{let a=(lo-p)/d,c=(hi-p)/d;if(a>c)[a,c]=[c,a];near=Math.max(near,a);far=Math.min(far,c);if(near>=far-1e-8){miss=true;break;}}
      }
      if(!miss&&far>1e-7&&near<1-1e-7)return false;
    }
    return true;
  }
  // Eight-connected Dijkstra distances make diagonal routes consistent.
  const heap=[];
  function push(index,cost){let i=heap.length;heap.push([index,cost]);while(i>0){const p=(i-1)>>1;if(heap[p][1]<=cost)break;heap[i]=heap[p];i=p;}heap[i]=[index,cost];}
  function pop(){const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[i]=heap[c];i=c;}heap[i]=last;}return result;}
  function rebuild(p){
    distance.fill(Infinity);heap.length=0;const c=cellOf(p.x,p.z);let target=c.z*nx+c.x;
    if(blocked[target]){let best=Infinity;target=-1;for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const i=z*nx+x;if(blocked[i])continue;const v=center(x,z),d=(v.x-p.x)**2+(v.z-p.z)**2;if(d<best){best=d;target=i;}}}
    if(target<0)return;distance[target]=0;push(target,0);
    while(heap.length){
      const [i,cost]=pop();if(cost>distance[i]+1e-8)continue;const x=i%nx,z=(i/nx)|0;
      for(const [dx,dz,weight]of adjacent){const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const j=zz*nx+xx;if(blocked[j])continue;if(dx&&dz&&(blocked[z*nx+xx]||blocked[zz*nx+x]))continue;const next=cost+weight;if(next>=distance[j]-1e-8)continue;distance[j]=next;push(j,next);}
    }
  }
  function direction(p,target){
    if(hasClearPath(p,target))return {x:target.x-p.x,z:target.z-p.z};
    const c=cellOf(p.x,p.z);let choice=null,bestScore=Infinity,bestDistance=Infinity;
    // Consider only visible, body-clear centers; this also recovers from
    // knockback into the edge of a blocked grid cell.
    for(let radius=2;radius<=4&&!choice;radius+=2){
      for(let z=Math.max(0,c.z-radius);z<=Math.min(nz-1,c.z+radius);z++)for(let x=Math.max(0,c.x-radius);x<=Math.min(nx-1,c.x+radius);x++){
        const i=z*nx+x;if(blocked[i]||!Number.isFinite(distance[i]))continue;
        const v=center(x,z),travel=Math.hypot(v.x-p.x,v.z-p.z);if(travel<.02||!hasClearPath(p,v))continue;
        const score=distance[i]+travel/cell;
        if(score<bestScore-1e-5||(Math.abs(score-bestScore)<=1e-5&&distance[i]<bestDistance)){choice=v;bestScore=score;bestDistance=distance[i];}
      }
    }
    return choice?{x:choice.x-p.x,z:choice.z-p.z}:{x:0,z:0};
  }
  return {rebuild,direction,hasClearPath};
}

