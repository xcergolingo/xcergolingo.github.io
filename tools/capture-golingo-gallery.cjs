'use strict';
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const OUT = path.resolve('games/media'); fs.mkdirSync(OUT, { recursive: true });
const games = [
 { id:'lagoon', url:'https://xcergolingo.github.io/far-cry-lagoon/' },
 { id:'word-folio', url:'https://xcergolingo.github.io/word-folio/' },
 { id:'super-flying-man', url:'https://xcergolingo.github.io/super-flying-man/' }
];
const report = { capturedAt:new Date().toISOString(), games:[] };
async function click(page, selector) {
 const el=page.locator(selector).first();
 if (!await el.isVisible().catch(()=>false)) return;
 await el.evaluate(e=>e.click()); await page.waitForTimeout(500);
}
(async()=>{
 const metadata={downloadUrl:'https://apps.apple.com/app/id1194977025',verified:true};
 try {
  const data=await (await fetch('https://itunes.apple.com/lookup?id=1194977025&country=us')).json();
  const app=data.results.find(a=>a.trackId===1194977025);
  if(app){metadata.app={name:app.trackName,seller:app.sellerName,id:app.trackId,minimumOsVersion:app.minimumOsVersion};
   fs.writeFileSync(path.join(OUT,'app-icon.png'),Buffer.from(await (await fetch(app.artworkUrl512)).arrayBuffer())); metadata.icon='media/app-icon.png';}
 }catch(e){console.log('APP_METADATA',e.message);}
 fs.writeFileSync(path.join(OUT,'app.json'),JSON.stringify(metadata,null,2));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 try {
  for(const game of games){
   const result={...game,errors:[]}; let context;
   try {
    const size=game.id==='lagoon'?{width:960,height:600}:{width:1280,height:800};
    context=await browser.newContext({viewport:size,deviceScaleFactor:1,recordVideo:{dir:path.join(OUT,'.raw',game.id),size}});
    const page=await context.newPage();page.setDefaultTimeout(45000);
    page.on('pageerror',e=>result.errors.push(e.message));
    const video=page.video(),begun=Date.now();
    const response=await page.goto(game.url,{waitUntil:'domcontentloaded',timeout:90000});result.httpStatus=response.status();
    if(!response.ok())throw Error(`HTTP ${response.status()}`);
    await page.locator('canvas').first().waitFor({state:'visible',timeout:45000}); await page.waitForTimeout(5500);
    if(game.id==='lagoon'){
     // Prefer the game's own Low preset on this software-rendered recording machine.
     await click(page,'#settings-open');
     result.selects=await page.locator('select').evaluateAll(list=>list.map(s=>({id:s.id,value:s.value,options:[...s.options].map(o=>({value:o.value,text:o.text}))})));
     console.log('LAGOON_SETTINGS',JSON.stringify(result.selects));
     await page.locator('select').evaluateAll(list=>{for(const s of list){const low=[...s.options].find(o=>/^low$/i.test(o.value)||/^low\b/i.test(o.text));if(low){s.value=low.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}});
     await click(page,'#settings-close');await click(page,'#play');await page.waitForTimeout(1800);
    }else if(game.id==='word-folio'){
     // Silent preview excludes only the recorder's missing-speech-voice notification.
     await page.addStyleTag({content:'#toast{display:none!important}'});
     await click(page,'#next');await page.waitForTimeout(2200);
    }else{await click(page,'#closeHow');await click(page,'#resumeButton');}
    result.startSeconds=(Date.now()-begun)/1000;
    if(game.id==='word-folio'){
     await page.waitForTimeout(1600);await click(page,'#reveal');await page.waitForTimeout(2100);
     await click(page,'#next');await page.waitForTimeout(2400);await click(page,'#reveal');await page.waitForTimeout(2200);
     await click(page,'#next');await page.waitForTimeout(2400);await click(page,'#reveal');await page.waitForTimeout(2200);
    }else{
     await page.keyboard.down('w');
     if(game.id==='super-flying-man')await page.keyboard.down('Space');
     await page.waitForTimeout(2200);await page.keyboard.up('Space');await page.waitForTimeout(2600);
     await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');await page.waitForTimeout(7500);await page.keyboard.up('w');
    }
    const raw=await video.path();await context.close();context=null;
    const mp4=path.join(OUT,`${game.id}.mp4`);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',result.startSeconds.toFixed(2),'-i',raw,'-t','12','-an','-vf','fps=24,scale=960:600','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',mp4]);
    execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',game.id==='super-flying-man'?'5':'1','-i',mp4,'-frames:v','1','-q:v','2',path.join(OUT,`${game.id}.jpg`)]);
    const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-print_format','json','-show_format',mp4],{encoding:'utf8'}));
    result.duration=Number(probe.format.duration);result.bytes=Number(probe.format.size);
    if(result.duration<8)throw Error('Recorded clip too short');result.success=true;
   }catch(e){result.success=false;result.failure=e.stack;if(context)await context.close().catch(()=>{});}
   report.games.push(result);console.log('CAPTURE_RESULT',JSON.stringify(result));
   fs.writeFileSync(path.join(OUT,'capture-report.json'),JSON.stringify(report,null,2));
  }
 }finally{await browser.close();}
 fs.rmSync(path.join(OUT,'.raw'),{recursive:true,force:true});
 if(report.games.some(g=>!g.success))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
