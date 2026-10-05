'use strict';
// Recording-only presentation adjustments do not modify any deployed game files.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const OUT=path.resolve('games/media');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const ctx=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1,recordVideo:{dir:path.join(OUT,'.raw'),size:{width:960,height:600}}});
 const page=await ctx.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const video=page.video();
  const response=await page.goto('https://xcergolingo.github.io/far-cry-lagoon/',{waitUntil:'domcontentloaded',timeout:90000});
  if(!response.ok())throw Error(`HTTP ${response.status()}`);
  await page.locator('canvas').first().waitFor({state:'visible'});await page.waitForTimeout(4500);
  await page.locator('#settings-open').evaluate(e=>e.click());
  await page.locator('#quality').selectOption('Low');
  await page.locator('#settings-close').evaluate(e=>e.click());
  await page.waitForTimeout(1500);await page.bringToFront();
  const box=await page.locator('#play').boundingBox();
  if(!box)throw Error('Start button has no hit target');
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(1600);
  if(!await page.evaluate(()=>!!document.pointerLockElement))throw Error('Pointer lock did not activate');
  const overlay=await page.locator('#play').evaluate(button=>{
   const candidates=[];
   for(let el=button.parentElement;el&&el!==document.body;el=el.parentElement){
    candidates.push({tag:el.tagName,id:el.id,classes:el.className,hasCanvas:!!el.querySelector('canvas')});
   }
   // Hide only the start-menu container, after the game's start action succeeded.
   let menu=button.parentElement;
   while(menu.parentElement&&menu.parentElement!==document.body&&!menu.parentElement.querySelector('canvas'))menu=menu.parentElement;
   if(menu.querySelector('canvas'))throw Error('Refusing to hide the game canvas');
   menu.style.setProperty('display','none','important');
   return{hiddenId:menu.id,hiddenTag:menu.tagName,candidates};
  });
  console.log('RECORDING_OVERLAY',JSON.stringify(overlay));
  await page.waitForTimeout(3000);
  await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');
  // Allow buffered capture frames to settle before a long continuous gameplay segment.
  await page.waitForTimeout(4000);
  for(let i=0;i<4;i++){
   await page.mouse.move(490+(i%2?10:-10),295,{steps:4});
   await page.keyboard.down('w');await page.waitForTimeout(1600);await page.keyboard.up('w');
   await page.waitForTimeout(1800);
  }
  await page.waitForTimeout(1800);
  const raw=await video.path();await ctx.close();
  const target=path.join(OUT,'lagoon.mp4');
  // Use the final 12 seconds, avoiding wall-clock/browser-recording timestamp drift.
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-sseof','-12','-i',raw,'-t','12','-an','-vf','fps=24,scale=960:600','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','2','-i',target,'-frames:v','1','-q:v','2',path.join(OUT,'lagoon.jpg')]);
  const report=JSON.parse(fs.readFileSync(path.join(OUT,'capture-report.json'),'utf8'));
  const entry=report.games.find(g=>g.id==='lagoon');entry.pointerLockVerified=true;entry.errors=errors;entry.recordingOverlay=overlay;entry.refreshedAt=new Date().toISOString();entry.bytes=fs.statSync(target).size;
  fs.writeFileSync(path.join(OUT,'capture-report.json'),JSON.stringify(report,null,2));
  fs.rmSync(path.join(OUT,'.raw'),{recursive:true,force:true});console.log('LAGOON_GAMEPLAY_OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
