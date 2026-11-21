const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test, before, after} = require('node:test');
const {chromium} = require('playwright');

const snippet = fs.readFileSync(path.join(__dirname, 'snippet.js'), 'utf8');
const storageKey = 'cupSrtLauncherPosition';
let browser;
before(async () => { browser = await chromium.launch({
  executablePath: process.env.CUPITOR_CHROME_PATH,
  headless: true, args: ['--no-sandbox'],
}); });
after(async () => { await browser?.close(); });

async function install(page) {
  await page.evaluate(() => {
    window.ticks = [];
    window.setInterval = fn => window.ticks.push(fn);
    window.LocalSubtitles = {postMessage() {}};
    window.YouTubeSubtitles = {postMessage() {}};
    window.launcherEvents = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture', 'click']) {
      document.addEventListener(type, e => {
        if (!e.target.id?.endsWith('-srt-toggle')) return;
        window.launcherEvents.push({type, pointerId: e.pointerId, button: e.button, detail: e.detail,
          x: e.clientX, y: e.clientY, expanded: e.target.getAttribute('aria-expanded')});
      }, true);
    }
  });
  await page.evaluate(snippet);
  await page.evaluate(() => window.ticks.forEach(fn => fn()));
}

async function drag(page, button, dx, dy, touch, cancel = false) {
  const box = await button.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (touch) {
    const session = await page.context().newCDPSession(page);
    const points = (px, py) => [{x: px, y: py, id: 1}];
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(x, y)});
    for (let step = 1; step <= 5; step++) {
      await session.send('Input.dispatchTouchEvent', {type: 'touchMove',
        touchPoints: points(x + dx * step / 5, y + dy * step / 5)});
    }
    await session.send('Input.dispatchTouchEvent', {type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: []});
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, {steps: 5});
    await page.mouse.up();
  }
}

async function visible(page, button, size) {
  await page.waitForFunction(({id, size}) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return r.x >= 11 && r.y >= 11 && r.right <= size.width - 11 && r.bottom <= size.height - 11;
  }, {id: await button.getAttribute('id'), size});
  const box = await button.boundingBox();
  assert.ok(box.x >= 11 && box.y >= 11, 'button stays inside the top and left edges');
  assert.ok(box.x + box.width <= size.width - 11, 'button stays inside the right edge');
  assert.ok(box.y + box.height <= size.height - 11, 'button stays inside the bottom edge');
}

async function expectToggle(page, button, before) {
  // Chromium may deliver a touch-generated click after the tap command returns.
  try {
    await page.waitForFunction(({id, before}) =>
      document.getElementById(id)?.getAttribute('aria-expanded') !== before,
    {id: await button.getAttribute('id'), before}, {timeout: 5000});
  } catch (error) {
    assert.fail(error.message + '\nLauncher events: ' + JSON.stringify(await page.evaluate(() => window.launcherEvents)));
  }
}

for (const youtube of [false, true]) for (const touch of [true, false]) {
  test(`${youtube ? 'YouTube' : 'Spotify'} SRT launcher supports ${touch ? 'touch' : 'mouse'} dragging, taps, reload and rotation`, async () => {
    const size = touch ? {width: 390, height: 844} : {width: 1200, height: 800};
    const context = await browser.newContext({viewport: size, hasTouch: touch, isMobile: touch});
    try {
      const page = await context.newPage();
      await page.route('**/*', route => route.fulfill({contentType: 'text/html', body:
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<style>body{margin:0;background:#444}</style></head><body><main>' +
        (youtube ? '<div id="movie_player"><video style="width:100%;height:220px"></video></div>' : '<h1>Spotify player</h1>') +
        '</main></body></html>'}));
      await page.goto(youtube ? 'https://m.youtube.com/watch?v=abcdefghijk' : 'https://open.spotify.com/track/first123');
      await install(page);
      const button = page.locator(youtube ? '#cup-youtube-srt-toggle' : '#cup-spotify-srt-toggle');
      const tap = () => touch ? button.tap() : button.click();
      const initial = await button.getAttribute('aria-expanded');
      await tap();
      await expectToggle(page, button, initial);
      await button.focus();
      await button.press('Enter');
      assert.equal(await button.getAttribute('aria-expanded'), initial, 'keyboard activation still works');

      const start = await button.boundingBox();
      await drag(page, button, -100, 220, touch);
      const moved = await button.boundingBox();
      assert.ok(Math.abs(moved.x - (start.x - 100)) < 2);
      assert.ok(Math.abs(moved.y - (start.y + 220)) < 2);
      assert.equal(await button.getAttribute('aria-expanded'), initial, 'releasing a drag does not toggle subtitles');
      const saved = await page.evaluate(key => localStorage.getItem(key), storageKey);
      assert.ok(saved, 'the position is saved');
      await page.evaluate(() => window.ticks.forEach(fn => fn()));
      assert.deepEqual(await button.boundingBox(), moved, 'polling leaves the button in place');
      await tap();
      await expectToggle(page, button, initial);

      await page.reload();
      await install(page);
      assert.deepEqual(await button.boundingBox(), moved, 'reopening the page restores the position');
      // A new injected version removes old listeners and restores its launcher.
      await page.evaluate(() => { window.__cupCapsInstalled.version--; });
      await page.evaluate(snippet);
      assert.equal(await button.count(), 1);
      assert.deepEqual(await button.boundingBox(), moved);

      const rotated = {width: size.height, height: size.width};
      await page.setViewportSize(rotated);
      await visible(page, button, rotated);
      await drag(page, button, -2000, -2000, touch);
      const topLeft = await button.boundingBox();
      await visible(page, button, rotated);
      assert.ok(Math.abs(topLeft.x - 12) < 1 && Math.abs(topLeft.y - 12) < 1);
      await drag(page, button, 4000, 4000, touch);
      await visible(page, button, rotated);
      await page.setViewportSize(size);
      await visible(page, button, size);
      if (touch) {
        const expanded = await button.getAttribute('aria-expanded');
        await drag(page, button, -70, -70, true, true);
        await tap();
        await expectToggle(page, button, expanded);
      }
    } finally { await context.close(); }
  });
}

test('the launcher works when saved position storage is unavailable', async () => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  try {
    const page = await context.newPage();
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: '<html><body>Spotify</body></html>'}));
    await page.goto('https://open.spotify.com/track/first123');
    await page.evaluate(() => {
      Object.defineProperty(window, 'localStorage', {get() { throw new Error('Storage unavailable'); }});
    });
    await install(page);
    const button = page.locator('#cup-spotify-srt-toggle');
    const initial = await button.getAttribute('aria-expanded');
    await drag(page, button, -80, 180, false);
    assert.equal(await button.getAttribute('aria-expanded'), initial);
    await button.click();
    assert.notEqual(await button.getAttribute('aria-expanded'), initial);
  } finally { await context.close(); }
});
