'use strict';
// Refresh Lagoon with actual pointer-lock activation. Preserve the completed book/flight recordings.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const OUT=path.resolve('games/media');
(async()=>{
 for(const name of ['word-folio.mp4','super-flying-man.mp4','app.json'])if(!fs.existsSync(path.join(OUT,name)))throw Error(`Missing completed asset: ${name}`);
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const ctx=await browser.newContext({viewport:{width:960,height:600},deviceScaleFactor:1,recordVideo:{dir:path.join(OUT,'.raw'),size:{width:960,height:600}}});
 const page=await ctx.newPage();page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const begun=Date.now(),video=page.video();
  const response=await page.goto('https://xcergolingo.github.io/far-cry-lagoon/',{waitUntil:'domcontentloaded',timeout:90000});
  if(!response.ok())throw Error(`HTTP ${response.status()}`);
  await page.locator('canvas').first().waitFor({state:'visible'});await page.waitForTimeout(5000);
  await page.locator('#settings-open').evaluate(e=>e.click());
  await page.locator('#quality').selectOption('Low');
  await page.locator('#settings-close').evaluate(e=>e.click());
  await page.waitForTimeout(1800);await page.bringToFront();
  const box=await page.locator('#play').boundingBox();
  if(!box)throw Error('Start button has no hit target');
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.waitForTimeout(2200);
  const state=await page.evaluate(()=>({locked:!!document.pointerLockElement,startVisible:!!document.querySelector('#play')?.getClientRects().length,text:document.body.innerText.slice(0,1800)}));
  console.log('LAGOON_ACTIVE_STATE',JSON.stringify(state));
  if(!state.locked)throw Error('Pointer lock did not activate; refusing to replace gameplay with a menu recording');
  const start=(Date.now()-begun)/1000;
  await page.keyboard.down('w');await page.waitForTimeout(2500);await page.keyboard.up('w');
  await page.mouse.move(515,295);await page.waitForTimeout(1800);
  await page.keyboard.down('d');await page.waitForTimeout(600);await page.keyboard.up('d');
  await page.keyboard.down('w');await page.waitForTimeout(3200);await page.keyboard.up('w');
  await page.waitForTimeout(4200);
  const raw=await video.path();await ctx.close();
  const target=path.join(OUT,'lagoon.mp4');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',start.toFixed(2),'-i',raw,'-t','12','-an','-vf','fps=24,scale=960:600','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',target]);
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss','1','-i',target,'-frames:v','1','-q:v','2',path.join(OUT,'lagoon.jpg')]);
  const report=JSON.parse(fs.readFileSync(path.join(OUT,'capture-report.json'),'utf8'));
  const entry=report.games.find(g=>g.id==='lagoon');entry.pointerLockVerified=true;entry.errors=errors;entry.refreshedAt=new Date().toISOString();entry.bytes=fs.statSync(target).size;
  fs.writeFileSync(path.join(OUT,'capture-report.json'),JSON.stringify(report,null,2));
  fs.rmSync(path.join(OUT,'.raw'),{recursive:true,force:true});console.log('LAGOON_GAMEPLAY_OK');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
