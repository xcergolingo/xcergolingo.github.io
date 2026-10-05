'use strict';
// Record the existing game; do not change its deployed source.
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
  const r=await page.goto('https://xcergolingo.github.io/far-cry-lagoon/',{waitUntil:'domcontentloaded',timeout:90000});
  if(!r.ok())throw Error(`HTTP ${r.status()}`);
  await page.locator('canvas').first().waitFor({state:'visible'});await page.waitForTimeout(4500);
  await page.locator('#settings-open').evaluate(e=>e.click());
  await page.locator('#quality').selectOption('Low');
  await page.locator('#settings-close').evaluate(e=>e.click());await page.waitForTimeout(1200);
  // Establish the pointer position before requesting pointer lock, avoiding a camera jump.
  const box=await page.locator('#play').boundingBox();if(!box)throw Error('Missing start button');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.mouse.up();await page.waitForTimeout(1500);
  if(!await page.evaluate(()=>!!document.pointerLockElement))throw Error('Pointer lock did not activate');
  await page.locator('#menu').evaluate(menu=>menu.style.setProperty('display','none','important'));
  await page.waitForTimeout(5000);
  // Keep the authored level camera; pointer-lock deltas from absolute mouse motion
  // in a headless recorder are not representative of the player's camera control.
  await page.keyboard.down('w');await page.waitForTimeout(1100);await page.keyboard.up('w');
  await page.waitForTimeout(4500);
  await page.keyboard.down('a');await page.waitForTimeout(450);await page.keyboard.up('a');
  await page.waitForTimeout(9000);
  const raw=await video.path();await ctx.close();const target=path.join(OUT,'lagoon.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-sseof','-12','-i',raw,'-t','12','-an','-vf','fps=24,scale=960:600','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','2','-i',target,'-frames:v','1','-q:v','2',path.join(OUT,'lagoon.jpg')]);
  const report=JSON.parse(fs.readFileSync(path.join(OUT,'capture-report.json'),'utf8')),entry=report.games.find(g=>g.id==='lagoon');
  Object.assign(entry,{pointerLockVerified:true,errors,recordingOverlay:{hiddenId:'menu',reason:'Recording-only start-overlay cleanup after entering the game'},levelCamera:true,refreshedAt:new Date().toISOString(),bytes:fs.statSync(target).size});
  fs.writeFileSync(path.join(OUT,'capture-report.json'),JSON.stringify(report,null,2));fs.rmSync(path.join(OUT,'.raw'),{recursive:true,force:true});
  console.log('LAGOON_GAMEPLAY_OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
