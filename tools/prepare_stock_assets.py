"""Package publicly served game asset data, without copying the website's renderer code."""
from pathlib import Path
from urllib.request import Request,urlopen
from concurrent.futures import ThreadPoolExecutor
import json,gzip,io,struct,os,re
from urllib.parse import urljoin
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
WORK=Path(os.environ.get('VIEWER_ASSET_CACHE',str(ROOT/'.asset-cache')))
WORK.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'web/assets'
CACHE=WORK/'stock-packs';CACHE.mkdir(exist_ok=True)
BASE='https://theimpound.com/cdn/shop/files/'
def request(url):
    return urlopen(Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
if not (WORK/'catalog.json').exists():
    page=request('https://theimpound.com/pages/paint-viewer').decode('utf-8')
    settings=json.loads(re.search(r'<script[^>]*data-settings[^>]*>(.*?)</script>',page,re.S).group(1))
    (WORK/'catalog.json').write_bytes(request(urljoin('https://theimpound.com/',settings['manifest'])))
catalog=json.loads((WORK/'catalog.json').read_text(encoding='utf-8'))
ship=next(s for s in catalog['ships'] if s['id']=='890-jump')
profile=json.loads(request(BASE+ship['profile']))
needed=set()
def visit(value):
    if isinstance(value,dict):
        if 'image' in value:needed.add(value['image'])
        for v in value.values():visit(v)
    elif isinstance(value,list):
        for v in value:visit(v)
hashes=set(profile['base'].values())
profile['profiles']={h:profile['profiles'][h] for h in hashes};profile['paints']=[]
for value in profile['profiles'].values():visit(value)
packs={catalog['textures'][key][0] for key in needed}
def fetch(name):
    path=CACHE/name
    if not path.exists():
        for attempt in range(3):
            try:
                raw=urlopen(Request(BASE+name,headers={'User-Agent':'Mozilla/5.0'}),timeout=60).read()
                path.write_bytes(raw);break
            except Exception:
                if attempt==2:raise
    return name,path.read_bytes()
images=OUT/'textures';images.mkdir(exist_ok=True)
with ThreadPoolExecutor(max_workers=8) as pool:
    for count,(name,raw) in enumerate(pool.map(fetch,sorted(packs)),1):
        unpacked=gzip.decompress(raw) if raw[:2]==b'\x1f\x8b' else raw
        for key in needed:
            file,offset,length=catalog['textures'][key]
            if file!=name:continue
            image=Image.open(io.BytesIO(unpacked[offset:offset+length])).convert('RGBA')
            image.thumbnail((512,512),Image.Resampling.LANCZOS)
            image.save(images/(key+'.png'),optimize=True)
        print('PACK',count,len(packs),flush=True)
attrs=fetch(ship['attributes'])[1]
if attrs[:2]==b'\x1f\x8b':attrs=gzip.decompress(attrs)
(OUT/'surface-attributes.json').write_bytes(attrs)
(OUT/'stock-materials.json').write_text(json.dumps(profile,separators=(',',':')),encoding='utf-8')
(OUT/'890jump.glb').write_bytes(b''.join(fetch(name)[1] for name in ship['model']))
b=(OUT/'890jump.glb').read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n])
triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
info={'source':'Game-file 890 Jump stock geometry and material profiles served by The Impound Paint Viewer','sourceURL':'https://theimpound.com/pages/paint-viewer?ship=890-jump&paint=stock','date':'2026-11-23','triangles':triangles,'bytes':len(b),'textureImages':len(needed),'materialProfiles':len(profile['profiles']),'renderer':'Independent Three.js implementation; third-party website renderer code is not included.'}
(OUT/'model-info.json').write_text(json.dumps(info,indent=2),encoding='utf-8')
print('DONE',info,flush=True)
