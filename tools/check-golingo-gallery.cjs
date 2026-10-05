'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const BASE='https://xcergolingo.github.io/games/',OUT='gallery-check';fs.mkdirSync(OUT,{recursive:true});
const report={checkedAt:new Date().toISOString(),url:BASE,checks:[],errors:[],failures:[]};
const assets=['','style.css','app.js','media/app-icon.png','media/download-qr.svg','media/lagoon.jpg','media/lagoon.mp4','media/word-folio.jpg','media/word-folio.mp4','media/super-flying-man.jpg','media/super-flying-man.mp4'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 for(let attempt=0;attempt<24;attempt++){
  report.assets=await Promise.all(assets.map(async p=>{try{const r=await fetch(BASE+p+'?release=2',{method:'HEAD',signal:AbortSignal.timeout(15000)});return[p,r.status,r.headers.get('content-type')];}catch(e){return[p,e.message];}}));
  if(report.assets.every(a=>a[1]===200))break;await sleep(10000);
 }
 assert(report.assets.every(a=>a[1]===200),'A published website asset is unavailable');
 const executablePath=['/usr/bin/google-chrome','/usr/bin/google-chrome-stable'].find(p=>fs.existsSync(p));
 report.browser=executablePath||'playwright chromium';
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  for(const width of [1280,768,390,320]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
   const page=await context.newPage(),check={width,playback:[],requests:[]};report.checks.push(check);
   page.on('pageerror',e=>report.errors.push({width,message:e.message}));
   page.on('requestfailed',r=>check.requests.push({url:r.url(),error:r.failure()}));
   page.on('response',r=>{if(r.url().includes('.mp4'))check.requests.push({url:r.url(),status:r.status(),headers:r.headers()});});
   const response=await page.goto(BASE+'?release-check=2',{waitUntil:'networkidle',timeout:60000});assert.equal(response.status(),200);
   for(const selector of ['.game-card','#download'])for(const node of await page.locator(selector).all())await node.scrollIntoViewIfNeeded();
   await page.waitForTimeout(900);
   check.structure=await page.evaluate(()=>({title:document.title,cards:document.querySelectorAll('.game-card').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,downloads:[...document.querySelectorAll('.download-link')].map(a=>a.href),images:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0}))}));
   assert.equal(check.structure.cards,3);assert(check.structure.scrollWidth<=width+1,'Horizontal overflow at '+width);
   assert(check.structure.downloads.length>=8&&check.structure.downloads.every(u=>u==='https://apps.apple.com/app/id1194977025'));
   assert(check.structure.images.every(i=>i.ok),'Missing image');
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(300);await page.screenshot({path:`${OUT}/website-${width}.png`,fullPage:true});
   for(const id of ['lagoon','word-folio','super-flying-man']){
    await page.locator(`.game-cover[data-preview="${id}"]`).click();
    await page.waitForTimeout(1500);
    await page.waitForFunction(()=>{const v=document.getElementById('preview-video');return v.readyState>=2||v.error;},null,{timeout:12000}).catch(()=>{});
    const state=await page.locator('#preview-video').evaluate(async v=>{let playError=null;try{await Promise.race([v.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('play timed out')),3000))]);}catch(e){playError=e.message;}return{src:v.src,attribute:v.getAttribute('src'),currentSrc:v.currentSrc,duration:v.duration,time:v.currentTime,readyState:v.readyState,networkState:v.networkState,paused:v.paused,width:v.videoWidth,height:v.videoHeight,error:v.error?{code:v.error.code,message:v.error.message}:null,playError,canPlay:v.canPlayType('video/mp4; codecs="avc1.64001f"'),dialogOpen:document.getElementById('preview-dialog').open};});
    await page.waitForTimeout(800);state.advanced=await page.locator('#preview-video').evaluate(v=>v.currentTime);
    state.success=state.duration>=8&&state.advanced>0&&!state.error&&state.dialogOpen;check.playback.push({id,...state});
    if(!state.success){report.failures.push({width,id,state});await page.screenshot({path:`${OUT}/player-failure-${width}-${id}.png`});}
    if(width===390&&id==='word-folio')await page.screenshot({path:`${OUT}/mobile-video-player.png`});
    await page.locator('#close-preview').click();assert(!await page.locator('#preview-dialog').evaluate(d=>d.open));
   }
   await page.locator('.faq-list summary').first().click();check.faq=await page.locator('.faq-list details').first().evaluate(d=>d.open);assert(check.faq);
   fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));await context.close();console.log('VIEWPORT_CHECK',width,JSON.stringify(check.playback));
  }
  report.success=report.errors.length===0&&report.failures.length===0;
  if(!report.success)process.exitCode=1;
 }finally{await browser.close();fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));}
 console.log('GALLERY_RELEASE',report.success,BASE);
})().catch(e=>{report.success=false;report.failure=e.stack;fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});
