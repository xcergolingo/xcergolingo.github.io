'use strict';
// Records existing public games. Does not change their source, saved lessons, or deployment.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const OUT = path.resolve('games/media');
fs.mkdirSync(OUT, { recursive: true });
const games = [
  { id: 'lagoon', name: 'Lagoon', url: 'https://xcergolingo.github.io/far-cry-lagoon/' },
  { id: 'word-folio', name: 'Word Folio', url: 'https://xcergolingo.github.io/word-folio/' },
  { id: 'super-flying-man', name: 'Super Flying Man', url: 'https://xcergolingo.github.io/super-flying-man/' }
];
const report = { capturedAt: new Date().toISOString(), downloadUrl: 'https://www.golingoapp.com/', appStoreVerified: false, games: [] };
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return response;
}
async function clickVisible(page, selector) {
  const el = page.locator(selector).first();
  if (await el.isVisible().catch(() => false)) {
    await el.click({ timeout: 4000 });
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}
async function tapMatchingStart(page) {
  for (const item of await page.locator('button').all()) {
    if (!await item.isVisible().catch(() => false)) continue;
    const text = (await item.innerText()).trim();
    if (/^(enter|start|begin|play|explore|let.s go|continue)\b/i.test(text) && !/audio|music|sound|video/i.test(text)) {
      await item.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      return text;
    }
  }
  return null;
}
async function downloadMetadata() {
  try {
    const html = await (await get('https://www.golingoapp.com/')).text();
    const links = [...html.matchAll(/https?:\/\/(?:apps\.apple\.com|itunes\.apple\.com)\/[^\s"'<>\\]+/gi)].map(x => x[0].replace(/&amp;/g, '&'));
    console.log('OFFICIAL_SITE_APP_LINKS', JSON.stringify(links));
    const direct = links.find(x => /\/id\d+/.test(x));
    if (direct) { report.downloadUrl = direct; report.appStoreVerified = true; }
  } catch (error) { console.log('Official website metadata:', error.message); }
  try {
    const data = await (await get('https://itunes.apple.com/search?term=golingo&entity=software&country=us&limit=50')).json();
    console.log('APP_SEARCH', JSON.stringify(data.results.map(x => ({ name: x.trackName, seller: x.sellerName, id: x.trackId }))));
    const app = data.results.find(x => /golingo/i.test(x.trackName) && /xcer/i.test(`${x.sellerName} ${x.artistName}`));
    if (app) {
      report.app = { name: app.trackName, seller: app.sellerName, id: app.trackId, minimumOsVersion: app.minimumOsVersion, price: app.price, version: app.version };
      report.downloadUrl = `https://apps.apple.com/app/id${app.trackId}`;
      report.appStoreVerified = true;
      if (app.artworkUrl512) {
        fs.writeFileSync(path.join(OUT, 'app-icon.png'), Buffer.from(await (await get(app.artworkUrl512)).arrayBuffer()));
        report.appIcon = 'media/app-icon.png';
      }
    }
  } catch (error) { console.log('App Store metadata:', error.message); }
  fs.writeFileSync(path.join(OUT, 'app.json'), JSON.stringify({ downloadUrl: report.downloadUrl, verified: report.appStoreVerified, app: report.app || null, icon: report.appIcon || null }, null, 2));
}
(async () => {
  await downloadMetadata();
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const game of games) {
      const result = { ...game, errors: [] };
      let context;
      try {
        const dir = path.join(OUT, '.raw', game.id);
        context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', recordVideo: { dir, size: { width: 1280, height: 800 } } });
        const page = await context.newPage();
        page.on('pageerror', e => { result.errors.push(e.message); console.log(game.id, 'PAGE_ERROR', e.message); });
        page.on('console', m => { if (m.type() === 'error') console.log(game.id, 'CONSOLE_ERROR', m.text().slice(0, 400)); });
        const video = page.video();
        const begun = Date.now();
        const response = await page.goto(game.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        result.httpStatus = response.status();
        if (!response.ok()) throw Error(`Game returned HTTP ${response.status()}`);
        await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 45000 });
        await page.waitForTimeout(6500);
        result.title = await page.title();
        result.buttons = await page.locator('button').evaluateAll(items => items.map(x => ({ id: x.id, text: x.textContent.trim().slice(0, 100), visible: !!(x.offsetWidth || x.offsetHeight) })));
        console.log('GAME_UI', game.id, JSON.stringify(result.buttons));
        if (game.id === 'word-folio') {
          await clickVisible(page, '#next');
          await page.waitForTimeout(2200);
        } else if (game.id === 'lagoon') {
          result.startButton = await tapMatchingStart(page);
          await page.waitForTimeout(1800);
        } else {
          await clickVisible(page, '#closeHow');
          await clickVisible(page, '#resumeButton');
          if (await clickVisible(page, '#languageButton')) {
            if (await page.locator('#demoWords').isVisible().catch(() => false)) await clickVisible(page, '#demoWords');
            await clickVisible(page, '#closeLanguage');
          }
          await page.mouse.move(640, 390);
        }
        for (const selector of ['#fatal', '#loading']) {
          const visible = await page.locator(selector).isVisible().catch(() => false);
          if (visible) throw Error(`Game is blocked by ${selector}: ${await page.locator(selector).innerText()}`);
        }
        await page.screenshot({ path: path.join(OUT, `${game.id}.jpg`), type: 'jpeg', quality: 88 });
        result.startSeconds = (Date.now() - begun) / 1000;
        if (game.id === 'word-folio') {
          await page.waitForTimeout(1600);
          await clickVisible(page, '#reveal');
          await page.waitForTimeout(1900);
          await clickVisible(page, '#next');
          await page.waitForTimeout(2400);
          await clickVisible(page, '#reveal');
          await page.waitForTimeout(1800);
          await clickVisible(page, '#next');
          await page.waitForTimeout(2600);
          await clickVisible(page, '#reveal');
          await page.waitForTimeout(1700);
        } else if (game.id === 'super-flying-man') {
          await page.keyboard.down('w');
          await page.keyboard.down('Space');
          await page.waitForTimeout(2200);
          await page.keyboard.up('Space');
          await page.waitForTimeout(2200);
          await page.keyboard.down('d');
          await page.waitForTimeout(500);
          await page.keyboard.up('d');
          await page.waitForTimeout(2300);
          await page.screenshot({ path: path.join(OUT, `${game.id}.jpg`), type: 'jpeg', quality: 88 });
          await page.keyboard.down('Space');
          await page.waitForTimeout(1800);
          await page.keyboard.up('Space');
          await page.waitForTimeout(2700);
          await page.keyboard.up('w');
        } else {
          await page.mouse.move(640, 380);
          await page.keyboard.down('w');
          await page.waitForTimeout(3200);
          await page.keyboard.up('w');
          await page.waitForTimeout(1800);
          await page.keyboard.down('d');
          await page.waitForTimeout(1100);
          await page.keyboard.up('d');
          await page.keyboard.down('w');
          await page.waitForTimeout(3500);
          await page.keyboard.up('w');
          await page.waitForTimeout(2400);
        }
        result.bodyExcerpt = (await page.locator('body').innerText()).slice(0, 5500);
        result.canvas = await page.locator('canvas').first().evaluate(c => ({ width: c.width, height: c.height }));
        const rawPath = await video.path();
        await context.close(); context = null;
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(result.startSeconds.toFixed(2)), '-i', rawPath, '-t', '12', '-an', '-vf', 'fps=24,scale=960:600', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `${game.id}.mp4`)]);
        const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', path.join(OUT, `${game.id}.mp4`)], { encoding: 'utf8' }));
        result.duration = Number(metadata.format.duration);
        result.bytes = Number(metadata.format.size);
        if (result.duration < 8) throw Error('Recorded video is unexpectedly short');
        result.success = true;
        console.log('RECORDED', game.id, result.duration, result.bytes);
      } catch (error) {
        result.success = false;
        result.failure = error.stack;
        console.log('CAPTURE_FAILED', game.id, error.stack);
        if (context) {
          await context.pages()[0]?.screenshot({ path: path.join(OUT, `${game.id}-diagnostic.jpg`), type: 'jpeg' }).catch(() => {});
          await context.close().catch(() => {});
        }
      }
      report.games.push(result);
      fs.writeFileSync(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 2));
    }
  } finally { await browser.close(); }
  fs.rmSync(path.join(OUT, '.raw'), { recursive: true, force: true });
  console.log('GOLINGO_GALLERY_RESULT', JSON.stringify(report, null, 2));
  if (report.games.some(x => !x.success)) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
