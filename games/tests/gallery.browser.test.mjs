// Optional real-browser companion to gallery.test.mjs.
// Requires Playwright and an installed Chromium. Run in a browser-capable environment:
// node games/tests/gallery.browser.test.mjs
// Override the browser with PLAYWRIGHT_CHROMIUM_EXECUTABLE; reports/screenshots go to a temp folder.
// Navigation to games and download destinations is intercepted, never sent to production.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, stat, mkdtemp, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve, extname, join, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const artifacts = await mkdtemp(join(tmpdir(), 'golingo-gallery-browser-'));
const mime = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4'};
const server = createServer(async (req, res) => {
  try {
    let path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!path.startsWith(root + sep) && path !== root) throw Error('Invalid path');
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, {'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'no-store'});
    res.end(data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
let browser;
const results = [];

async function setup(width, height) {
  const context = await browser.newContext({viewport: {width, height}, reducedMotion: 'reduce'});
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.isNavigationRequest() && (url.origin !== base || !['/games/', '/games/index.html'].includes(url.pathname))) {
      return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><title>Test game destination</title><body><h1 id="test-destination">Launch received</h1></body></html>'});
    }
    return url.origin === base ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/games/', {waitUntil: 'domcontentloaded'});
  await page.waitForSelector('.game-favorite');
  return {context, page, errors};
}
const visibleIDs = page => page.locator('.game-card:not([hidden])').evaluateAll(cards => cards.map(card => card.id));
const count = (page, id) => page.locator(`#${id} .game-plays`).textContent().then(text => Number(text.replace(/[^\d]/g, '')));

try {
  browser = await chromium.launch({headless: true, executablePath, args: ['--no-sandbox']});
  for (const [width, height] of [[320, 700], [390, 844], [844, 390], [1280, 900]]) {
    const {context, page, errors} = await setup(width, height);
    try {
      const total = await page.locator('.game-card').count();
      const dimensions = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, viewport: innerWidth}));
      assert(dimensions.scroll <= dimensions.viewport + 1, `Horizontal overflow at ${width}x${height}`);
      await page.locator('#game-search').scrollIntoViewIfNeeded();
      const font = await page.locator('#game-search').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
      if (width <= 600) assert(font >= 16, 'Search font must avoid iOS focus zoom');
      for (const selector of ['#game-search', '#favorites-toggle', '#game-sort', '#matterhorn .game-favorite', '#matterhorn .game-like']) {
        const box = await page.locator(selector).boundingBox();
        assert(box && box.height >= 42, `${selector} needs a usable touch target`);
      }
      await page.screenshot({path: join(artifacts, `controls-${width}x${height}.png`)});
      await page.locator('#game-search').fill('SÁKURAGAOKA');
      assert.deepEqual(await visibleIDs(page), ['sakuragaoka']);
      await page.locator('#search-clear').click();
      await page.locator('#matterhorn .game-favorite').click();
      await page.locator('#favorites-toggle').click();
      assert.deepEqual(await visibleIDs(page), ['matterhorn']);
      await page.locator('#game-search').fill('nonexistent-game-76508');
      assert.equal(await page.locator('#hub-empty').isVisible(), true);
      await page.locator('#filters-reset').click();
      assert.equal((await visibleIDs(page)).length, total);
      await page.locator('#game-sort').selectOption('plays');
      await page.reload({waitUntil: 'domcontentloaded'});
      assert.equal(await page.locator('#matterhorn .game-favorite').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#game-sort').inputValue(), 'plays');
      assert.equal(await count(page, 'matterhorn'), 0);
      assert.deepEqual(errors, []);
      results.push({viewport: `${width}x${height}`, cards: total, passed: true});
    } finally { await context.close(); }
  }

  const {context, page, errors} = await setup(390, 844);
  try {
    const lesson = {primaryLanguage: 'en', learningLanguage: 'ja', words: [{id: '101', word: '水', translation: 'water', sentence: '水を飲みます。', sentenceTranslation: 'I drink water.'}]};
    await page.locator('#lesson-input').fill(JSON.stringify(lesson));
    await page.locator('#lesson-save').click();
    await page.locator('#lagoon [data-preview]').click();
    assert.equal(await count(page, 'lagoon'), 0, 'Video preview is not a play');
    await page.locator('#dialog-demo').click();
    await page.waitForSelector('#test-destination');
    assert.deepEqual(JSON.parse(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('golingoLesson')), lesson);
    await page.goBack({waitUntil: 'domcontentloaded'});
    await page.waitForSelector('.game-favorite');
    if (await page.locator('#preview-dialog').evaluate(node => node.open)) await page.locator('#close-preview').click();
    assert.equal(await count(page, 'lagoon'), 1);
    await page.reload({waitUntil: 'domcontentloaded'});
    assert.equal(await count(page, 'lagoon'), 1, 'Reload must not increment');
    await page.locator('#sakuragaoka a.game-cover').click();
    await page.waitForSelector('#test-destination');
    assert.deepEqual(JSON.parse(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('golingo')).words[0], lesson.words[0]);
    await page.goBack({waitUntil: 'domcontentloaded'});
    await page.waitForSelector('.game-favorite');
    assert.equal(await count(page, 'sakuragaoka'), 1);
    await page.locator('#game-sort').selectOption('plays');
    const order = await visibleIDs(page);
    assert(order.slice(0, 2).includes('lagoon') && order.slice(0, 2).includes('sakuragaoka'));
    assert.deepEqual(errors, []);
    results.push({test: 'Real navigation, dialog handoff, return and persistence', passed: true});
  } finally { await context.close(); }
  const report = {passed: true, browser: 'Chromium', results, artifacts};
  await writeFile(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
