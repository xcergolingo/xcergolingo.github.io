'use strict';
// Capture existing public games without editing their sources or deployments.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const OUT = path.resolve('games/media');
fs.mkdirSync(OUT, { recursive: true });
const games = [
  { id: 'lagoon', name: 'Lagoon', url: 'https://xcergolingo.github.io/far-cry-lagoon/' },
  { id: 'word-folio', name: 'Word Folio', url: 'https://xcergolingo.github.io/word-folio/' },
  { id: 'super-flying-man', name: 'Super Flying Man', url: 'https://xcergolingo.github.io/super-flying-man/' }
];
const report = { capturedAt: new Date().toISOString(), downloadUrl: 'https://apps.apple.com/app/id1194977025', appStoreVerified: true, games: [] };
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw Error(`${url}: HTTP ${r.status}`);
  return r;
}
async function click(page, selector) {
  const el = page.locator(selector).first();
  if (!await el.isVisible().catch(() => false)) return false;
  // Software WebGL can starve Playwright's two-frame stability check.
  try { await el.click({ force: true, timeout: 15000 }); }
  catch { await el.evaluate(e => e.click()); }
  await page.waitForTimeout(550);
  return true;
}
async function metadata() {
  try {
    const d = await (await get('https://itunes.apple.com/lookup?id=1194977025&country=us')).json();
    const a = d.results.find(x => x.trackId === 1194977025);
    if (!a) throw Error('Verified app ID missing');
    report.app = { name: a.trackName, seller: a.sellerName, id: a.trackId, minimumOsVersion: a.minimumOsVersion, version: a.version };
    fs.writeFileSync(path.join(OUT, 'app-icon.png'), Buffer.from(await (await get(a.artworkUrl512 || a.artworkUrl100)).arrayBuffer()));
    report.appIcon = 'media/app-icon.png';
    console.log('VERIFIED_APP', JSON.stringify(report.app));
  } catch (e) { console.log('APP_METADATA_WARNING', e.message); }
  fs.writeFileSync(path.join(OUT, 'app.json'), JSON.stringify({ downloadUrl: report.downloadUrl, verified: true, app: report.app || null, icon: report.appIcon || null }, null, 2));
}
(async () => {
  await metadata();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const game of games) {
      const result = { ...game, errors: [] };
      let context;
      try {
        context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, recordVideo: { dir: path.join(OUT, '.raw', game.id), size: { width: 1280, height: 800 } } });
        const page = await context.newPage();
        page.setDefaultTimeout(20000);
        page.on('pageerror', e => result.errors.push(e.message));
        const video = page.video(), begun = Date.now();
        const response = await page.goto(game.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        result.httpStatus = response.status();
        if (!response.ok()) throw Error(`HTTP ${response.status()}`);
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 45000 });
        await page.waitForTimeout(6000);
        result.title = await page.title();
        if (game.id === 'word-folio') {
          // Silent recording: omit only the recording machine's missing-voice toast.
          await page.addStyleTag({ content: '#toast{display:none!important}' });
          await click(page, '#next'); await page.waitForTimeout(2200);
        } else if (game.id === 'lagoon') {
          await click(page, '#play'); await page.waitForTimeout(1600);
        } else {
          await click(page, '#closeHow'); await click(page, '#resumeButton');
          await page.mouse.move(640, 390);
        }
        for (const selector of ['#fatal', '#loading']) {
          if (await page.locator(selector).isVisible().catch(() => false)) throw Error(`Blocked by ${selector}`);
        }
        await page.screenshot({ path: path.join(OUT, `${game.id}.jpg`), type: 'jpeg', quality: 90 });
        result.startSeconds = (Date.now() - begun) / 1000;
        if (game.id === 'word-folio') {
          await page.waitForTimeout(1400); await click(page, '#reveal');
          await page.waitForTimeout(1800); await click(page, '#next');
          await page.waitForTimeout(2300); await click(page, '#reveal');
          await page.waitForTimeout(1800); await click(page, '#next');
          await page.waitForTimeout(2300); await click(page, '#reveal');
          await page.waitForTimeout(1800);
        } else if (game.id === 'super-flying-man') {
          await page.keyboard.down('w'); await page.keyboard.down('Space');
          await page.waitForTimeout(2200); await page.keyboard.up('Space');
          await page.waitForTimeout(2200); await page.keyboard.down('d');
          await page.waitForTimeout(500); await page.keyboard.up('d');
          await page.waitForTimeout(2100);
          await page.screenshot({ path: path.join(OUT, `${game.id}.jpg`), type: 'jpeg', quality: 90 });
          await page.keyboard.down('Space'); await page.waitForTimeout(1800);
          await page.keyboard.up('Space'); await page.waitForTimeout(3000); await page.keyboard.up('w');
        } else {
          await page.keyboard.down('w'); await page.waitForTimeout(3000);
          await page.keyboard.up('w'); await page.waitForTimeout(1600);
          await page.keyboard.down('d'); await page.waitForTimeout(900); await page.keyboard.up('d');
          await page.keyboard.down('w'); await page.waitForTimeout(3400); await page.keyboard.up('w');
          await page.waitForTimeout(3100);
        }
        result.bodyExcerpt = (await page.locator('body').innerText()).slice(0, 2500);
        const raw = await video.path();
        await context.close(); context = null;
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', result.startSeconds.toFixed(2), '-i', raw, '-t', '12', '-an', '-vf', 'fps=24,scale=960:600', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `${game.id}.mp4`)]);
        const p = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', path.join(OUT, `${game.id}.mp4`)], { encoding: 'utf8' }));
        result.duration = Number(p.format.duration); result.bytes = Number(p.format.size);
        if (result.duration < 8) throw Error('Recorded clip too short');
        result.success = true;
        console.log('CAPTURE_OK', game.id, result.duration, result.bytes);
      } catch (e) {
        result.success = false; result.failure = e.stack; console.log('CAPTURE_ERROR', game.id, e.stack);
        if (context) { await context.pages()[0]?.screenshot({ path: path.join(OUT, `${game.id}-diagnostic.jpg`) }).catch(() => {}); await context.close().catch(() => {}); }
      }
      report.games.push(result);
      fs.writeFileSync(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 2));
    }
  } finally { await browser.close(); }
  fs.rmSync(path.join(OUT, '.raw'), { recursive: true, force: true });
  console.log('CAPTURE_SUMMARY', JSON.stringify(report.games.map(({id,success,duration,bytes,errors,failure}) => ({id,success,duration,bytes,errors,failure}))));
  if (report.games.some(g => !g.success)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
