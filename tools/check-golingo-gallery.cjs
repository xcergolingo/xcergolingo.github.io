'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const BASE='https://xcergolingo.github.io/games/';
const OUT='gallery-check';fs.mkdirSync(OUT,{recursive:true});
const report={checkedAt:new Date().toISOString(),url:BASE,checks:[],errors:[]};
const assets=['','style.css','app.js','media/app-icon.png','media/download-qr.svg','media/lagoon.jpg','media/lagoon.mp4','media/word-folio.jpg','media/word-folio.mp4','media/super-flying-man.jpg','media/super-flying-man.mp4'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let ready=false;
 for(let i=0;i<24;i++){
  const statuses=await Promise.all(assets.map(async p=>{try{const r=await fetch(BASE+p+'?release=1',{method:'HEAD',signal:AbortSignal.timeout(15000)});return [p,r.status];}catch(e){return[p,e.message];}}));
  if(statuses.every(x=>x[1]===200)){ready=true;report.assets=statuses;break;}
  console.log('WAITING_FOR_PAGES',JSON.stringify(statuses));await sleep(10000);
 }
 assert(ready,'The published site or one of its required media assets is unavailable');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
  for(const width of [1280,768,390,320]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push({width,message:e.message}));
   const response=await page.goto(BASE+'?release-check=1',{waitUntil:'networkidle',timeout:60000});assert.equal(response.status(),200);
   await page.locator('.game-card').last().scrollIntoViewIfNeeded();await page.locator('#download').scrollIntoViewIfNeeded();await page.waitForTimeout(600);
   const structure=await page.evaluate(()=>({title:document.title,cards:document.querySelectorAll('.game-card').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,downloads:[...document.querySelectorAll('.download-link')].map(a=>a.href),images:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0}))}));
   assert.equal(structure.cards,3);assert(structure.title.includes('GoLingo Games'));
   assert(structure.scrollWidth<=width+1,`Horizontal overflow at ${width}: ${structure.scrollWidth}`);
   assert(structure.downloads.length>=8&&structure.downloads.every(u=>u==='https://apps.apple.com/app/id1194977025'));
   assert(structure.images.every(i=>i.ok),'Missing image: '+JSON.stringify(structure.images));
   await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(400);
   await page.screenshot({path:`${OUT}/website-${width}.png`,fullPage:true});
   const playback=[];
   for(const id of ['lagoon','word-folio','super-flying-man']){
    await page.locator(`.game-cover[data-preview="${id}"]`).click();
    await page.waitForFunction(()=>document.getElementById('preview-video').readyState>=2,{},{timeout:30000});
    await page.waitForTimeout(1400);
    const v=await page.locator('#preview-video').evaluate(v=>({duration:v.duration,time:v.currentTime,paused:v.paused,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null}));
    assert(v.duration>=8&&v.time>0&&!v.error,'Video failed: '+id+' '+JSON.stringify(v));
    playback.push({id,...v});
    if(width===390&&id==='word-folio')await page.screenshot({path:`${OUT}/mobile-video-player.png`});
    await page.locator('#close-preview').click();
    assert(!await page.locator('#preview-dialog').evaluate(d=>d.open));
   }
   await page.locator('.faq-list summary').first().click();assert(await page.locator('.faq-list details').first().evaluate(d=>d.open));
   report.checks.push({width,structure,playback,faq:true});
   await context.close();console.log('VIEWPORT_OK',width);
  }
  assert.equal(report.errors.length,0,'Website JavaScript errors');report.success=true;
 }finally{await browser.close();fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));}
 console.log('GALLERY_RELEASE_OK',BASE);
})().catch(e=>{report.success=false;report.failure=e.stack;fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});
