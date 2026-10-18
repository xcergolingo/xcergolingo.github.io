"""Fetch public Mapzen Terrarium tiles and bake an offline Matterhorn heightfield.
Terrarium: meters = red*256 + green + blue/256 - 32768.
No requests are made by the finished game. See assets/terrain-provenance.json.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import numpy as np
import urllib.request, math, json, base64
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'assets'/'tiles'; CACHE.mkdir(parents=True,exist_ok=True)
Z=12; N=2**Z; PEAK_LON=7.6586; PEAK_LAT=45.9763
W,H=361,281
# Authentic massif, viewed from the north. The ski course is purpose-designed.
XMIN,XMAX=-9000,9000; ZMIN,ZMAX=-18000,-4000
xs=np.linspace(XMIN,XMAX,W); zs=np.linspace(ZMIN,ZMAX,H)
lons=PEAK_LON+(xs-350)/(111320*math.cos(math.radians(PEAK_LAT)))
lats=PEAK_LAT+(zs+8500)/111320
xt=(lons+180)/360*N
yt=(1-np.arcsinh(np.tan(np.radians(lats)))/math.pi)/2*N
coords=[(x,y) for x in range(math.floor(xt.min()),math.floor(xt.max())+1) for y in range(math.floor(yt.min()),math.floor(yt.max())+1)]
def fetch(c):
 x,y=c;p=CACHE/f'{Z}-{x}-{y}.png';url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png'
 if not p.exists():
  for attempt in range(3):
   try:
    with urllib.request.urlopen(url,timeout=25) as r:p.write_bytes(r.read())
    break
   except Exception:
    if attempt==2:raise
 a=np.asarray(Image.open(p).convert('RGB')).astype(float)
 return c,a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768
raw=dict(ThreadPoolExecutor(max_workers=8).map(fetch,coords))
def sample(tx,ty):
 # Bilinear interpolation also samples neighboring tiles across seams.
 px=tx*256-.5;py=ty*256-.5; ix=int(math.floor(px));iy=int(math.floor(py));fx=px-ix;fy=py-iy
 def v(a,b):return raw[(a//256,b//256)][b%256,a%256]
 return (1-fy)*((1-fx)*v(ix,iy)+fx*v(ix+1,iy))+fy*((1-fx)*v(ix,iy+1)+fx*v(ix+1,iy+1))
heights=np.array([[sample(x,y) for x in xt] for y in yt],dtype=float)
# Quarter-meter integers preserve the source values without a runtime decoder.
a=np.round(heights*4).astype('<u2')
meta={'source':'Mapzen / Tilezen public Terrarium elevation tiles','format':'uint16-le, quarter meters, row-major; row 0 is world zMin', 'width':W,'height':H,'xMin':XMIN,'xMax':XMAX,'zMin':ZMIN,'zMax':ZMAX,'peak':{'lat':PEAK_LAT,'lon':PEAK_LON,'elevation':4478,'worldX':350,'worldZ':-8500},'values':base64.b64encode(a.tobytes()).decode()}
(ROOT/'assets'/'matterhorn-dem.json').write_text(json.dumps(meta,separators=(',',':')))
prov={k:v for k,v in meta.items() if k!='values'}
prov.update({'zoom':Z,'tileCount':len(coords),'downloaded':'2026-10-17','tiles':[[Z,x,y] for x,y in coords],'urlTemplate':'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png','documentation':'https://github.com/tilezen/joerd/blob/master/docs/formats.md','attribution':'Mapzen / Tilezen; underlying SRTM and open elevation contributors. https://github.com/tilezen/joerd/blob/master/docs/attribution.md','note':'The distant massif uses real sampled elevation without vertical exaggeration. The foreground ski line and village are designed, not a navigable real piste. DEM sampling smooths the true summit.' ,'minimumMeters':float(heights.min()),'maximumMeters':float(heights.max())})
(ROOT/'assets'/'terrain-provenance.json').write_text(json.dumps(prov,indent=2))
print(json.dumps({'tiles':len(coords),'grid':[W,H],'heightRange':[round(heights.min()),round(heights.max())],'bytes':a.nbytes}))
