import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// This project has deliberately simple, local ES modules. Bundle those modules
// into isolated closures, retaining the unmodified Three.js license and source.
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=fs.existsSync(path.join(root,'dist','index.html'))?path.join(root,'dist'):root;
const files=['vendor/three.module.js','vendor/PointerLockControls.js','art.js','world.js','actors.js','effects.js','audio.js','navigation.js','input.js','lesson-data.js','learning.js','word-tags.js','main.js'];
const ids=new Map(files.map((file,i)=>[file,'M'+i]));
let script='/* INK & IRON — Complete offline edition. Three.js is MIT licensed. */\n(()=>{\n"use strict";\n';
for(const file of files){
 let code=fs.readFileSync(path.join(dir,file),'utf8'),names=[];
 code=code.replace(/^import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm,(_,binding,relative)=>{
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),relative));
  if(!ids.has(target))throw new Error('Unresolved local module '+target);
  const name=ids.get(target),b=binding.trim();
  if(b.startsWith('* as '))return `const ${b.slice(5).trim()}=${name};`;
  if(b.startsWith('{'))return `const ${b.replace(/\bas\b/g,':')}=${name};`;
  throw new Error('Unsupported import shape: '+b);
 });
 code=code.replace(/export\s*\{([^}]+)\}\s*;?/g,(_,list)=>{names.push(...list.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{const p=x.split(/\s+as\s+/);return p.length>1?p[1]+':'+p[0]:p[0];}));return '';});
 code=code.replace(/export\s+(function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,(_,kind,name)=>{names.push(name);return kind+' '+name;});
 script+=`\n// ${file}\nconst ${ids.get(file)}=(()=>{\n${code}\nreturn {${names.join(',')}};\n})();\n`;
}
script+='})();\n';
new vm.Script(script,{filename:'ink-and-iron-bundle.js'});
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
html=html.replace('<html lang="en">','<!--\n'+fs.readFileSync(path.join(dir,'vendor/THREE-LICENSE.txt'),'utf8')+'\n-->\n<html lang="en">');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+fs.readFileSync(path.join(dir,'style.css'),'utf8')+'</style>');
html=html.replace('<link rel="stylesheet" href="learning.css">','<style>'+fs.readFileSync(path.join(dir,'learning.css'),'utf8')+'</style>');
html=html.replace('<script type="module" src="main.js"></script>','<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
const output=path.join(dir,'Ink-and-Iron.html');fs.writeFileSync(output,html);
process.stdout.write(JSON.stringify({output,bytes:Buffer.byteLength(html),modules:files.length,syntax:'passed'})+'\n');
