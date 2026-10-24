#!/usr/bin/env python3
"""Assemble the offline F-16 game. Python 3; no packages or downloads needed."""
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
ENGINE = HERE / 'three.min.js'
if not ENGINE.exists():
    ENGINE = HERE.parent / 'upload' / 'three.min.js'
OUTPUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else HERE / 'index.html'
html = (HERE / 'index.template.html').read_text(encoding='utf-8')
sources = [('ENGINE', ENGINE), ('VISUALS', HERE / 'f16-visuals.js'),
           ('LEARNING', HERE / 'f16-learning.js'), ('GAME', HERE / 'f16-game.js')]
for marker, source in sources:
    code = source.read_text(encoding='utf-8')
    code = re.sub(r'</script', r'<\\/script', code, flags=re.IGNORECASE)
    html = html.replace('<!-- ' + marker + ' -->', '<script>\n' + code + '\n</script>')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(html, encoding='utf-8')
print('Built', OUTPUT.name, '(' + str(OUTPUT.stat().st_size) + ' bytes)')
