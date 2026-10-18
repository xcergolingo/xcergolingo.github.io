import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const result=await build({entryPoints:['src/main.js'],bundle:true,format:'iife',target:['es2020'],minify:true,legalComments:'inline',write:false,logLevel:'warning'});
const css=await readFile('src/styles.css','utf8');
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const shell=await readFile('src/shell.html','utf8');
const html=shell.replace('/*__STYLES__*/',()=>css).replace('/*__SCRIPT__*/',()=>js);
await mkdir('dist',{recursive:true});await writeFile('dist/index.html',html);
console.log(`Standalone offline HTML: ${Buffer.byteLength(html).toLocaleString()} bytes.`);
