import {build} from 'esbuild';
import fs from 'node:fs/promises';
const engine=await build({entryPoints:['src/engine.js'],bundle:true,format:'iife',globalName:'ImmortalEngine',minify:true,write:false,legalComments:'inline'});
const [template,game]=await Promise.all([fs.readFile('src/template.html','utf8'),fs.readFile('src/game.js','utf8')]);
const out=template.replace('/* ENGINE_BUNDLE */',()=>engine.outputFiles[0].text.replaceAll('</script','<\\/script')).replace('/* GAME_CODE */',()=>game);
await fs.writeFile('index.html',out);
console.log('Self-contained HTML built:',Buffer.byteLength(out),'bytes');
