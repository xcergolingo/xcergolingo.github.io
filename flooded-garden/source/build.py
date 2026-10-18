"""Create a single HTML file with a pinned Three.js runtime embedded.

No model, image, font, audio, CDN, or build server is needed by the output.
The development sources and the upstream runtime retain their MIT notices.
"""
from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor
import re, posixpath, json, os

ROOT = Path(__file__).resolve().parent
CACHE = Path(os.environ.get('FLOODED_GARDEN_CACHE', ROOT/'.garden-cache'))
CACHE.mkdir(exist_ok=True, parents=True)
BASE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'
IMPORT = re.compile(r"^import\s+(.*?)\s+from\s+['\"]([^'\"]+)['\"];?", re.M | re.S)
EXPORT = re.compile(r'^export\s*\{([^}]+)\}\s*;?', re.M)

def resolve(parent, name):
    if name == 'three': return 'build/three.module.js'
    if name.startswith('three/addons/'): return name.replace('three/addons/', 'examples/jsm/', 1)
    return posixpath.normpath(posixpath.join(posixpath.dirname(parent), name))

def get(path):
    local = CACHE / path
    if not local.exists():
        local.parent.mkdir(parents=True, exist_ok=True)
        if not local.exists():
            request = Request(BASE + path, headers={'User-Agent': 'FloodedGardenBuild/1.0'})
            with urlopen(request, timeout=40) as response: local.write_bytes(response.read())
    return local.read_text()

source = (ROOT/'src/garden.js').read_text()
modules = {}
pending = {resolve('', name) for _, name in IMPORT.findall(source)}
while pending:
    tasks = sorted(pending)
    with ThreadPoolExecutor(max_workers=6) as pool:
        for path, code in zip(tasks, pool.map(get, tasks)): modules[path] = code
    pending = {resolve(path, name) for path in tasks for _, name in IMPORT.findall(modules[path]) if resolve(path, name) not in modules}

order, visited = [], set()
def visit(path):
    if path in visited: return
    visited.add(path)
    for _, name in IMPORT.findall(modules[path]): visit(resolve(path, name))
    order.append(path)
for path in sorted(modules):visit(path)

def import_binding(parent, match):
    binding, name = match.groups(); dependency = json.dumps(resolve(parent, name))
    if binding.strip().startswith('* as '): return f'const {binding.strip()[5:]} = __gardenModules[{dependency}];'
    binding = re.sub(r'\b(\w+)\s+as\s+(\w+)\b', r'\1: \2', binding)
    return f'const {binding} = __gardenModules[{dependency}];'

pieces = ['/* Three.js r170 and addons: Copyright Three.js Authors, MIT License. */', 'const __gardenModules = Object.create(null);']
for path in order:
    code = modules[path]
    names = []
    for match in EXPORT.finditer(code):
        for item in match.group(1).split(','):
            item = item.strip()
            if not item: continue
            pair = re.split(r'\s+as\s+', item)
            names.append(pair[0] if len(pair)==1 else f'{pair[1]}: {pair[0]}')
    code = IMPORT.sub(lambda match:import_binding(path, match), code)
    code = EXPORT.sub('', code)
    inline = re.findall(r'^export\s+(?:function|class|const|let|var)\s+(\w+)', code, re.M)
    names.extend(inline)
    code = re.sub(r'^export\s+(?=function|class|const|let|var)', '', code, flags=re.M)
    if re.search(r'^export\s', code, re.M): raise ValueError(f'Unhandled export in {path}')
    pieces.append(f'__gardenModules[{json.dumps(path)}] = (() => {{\n{code}\nreturn {{ {", ".join(names)} }};\n}})();')
pieces.append(IMPORT.sub(lambda match:import_binding('', match), source))
bundle = '\n'.join(pieces)
(ROOT/'dist').mkdir(exist_ok=True)
html = (ROOT/'src/shell.html').read_text().replace('<!-- GARDEN_SCRIPT -->', '<script type="module">\n'+bundle.replace('</script','<\\/script')+'\n</script>')
html=html.replace('</head>', '<!--\nEmbedded Three.js / addon license:\n'+(ROOT/'THIRD-PARTY-LICENSES.txt').read_text()+'\n-->\n</head>')
(ROOT/'dist/index.html').write_text(html)
(ROOT/'garden.bundle.mjs').write_text(bundle)
print(json.dumps({'modules':len(modules),'bytes':len(html.encode()),'output':str(ROOT/'dist/index.html')}))
