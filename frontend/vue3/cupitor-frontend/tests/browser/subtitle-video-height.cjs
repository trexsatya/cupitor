const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {before, after, test} = require('node:test');
const {chromium} = require('playwright');

// Mobile YouTube's video has an explicit inline size, but its immediate
// wrapper has zero height because the video is absolutely positioned.
// jsdom cannot reproduce the percentage max-height collapsing that video.
const fixture = `<!doctype html><html><head><style>
  body { margin: 0; }
  .player-container { position: fixed; top: 48px; left: 0; right: 0; overflow: hidden; }
  .player-size { position: relative; width: 100%; padding-bottom: 56.25%; overflow: hidden; }
  .player-api { display: flex; align-items: center; justify-content: center; }
  .html5-video-player { position: absolute; inset: 0; height: 100%; background: black; }
  .html5-video-container { position: relative; z-index: 10; }
  .html5-main-video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
</style></head><body>
  <div id="player-container-id" class="player-container sticky-player">
    <div id="player" class="player-api player-size">
      <div id="movie_player" class="html5-video-player">
        <div class="html5-video-container">
          <video class="html5-main-video" style="width:390px;height:219px;left:0;top:0"></video>
        </div>
      </div>
    </div>
    <div id="player-control-container"></div>
  </div>
</body></html>`;
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CUPITOR_CHROME_PATH,
    headless: true, args: ['--no-sandbox'],
  });
});
after(async () => { await browser?.close(); });

async function boot(run) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  try {
    const page = await context.newPage();
    await page.route('**/*', route => route.fulfill({contentType: 'text/html', body: fixture}));
    await page.goto('https://m.youtube.com/watch?v=abcdefghijk');
    await page.evaluate(() => {
      window.captionTicks = [];
      window.setInterval = fn => window.captionTicks.push(fn);
      window.YouTubeSubtitles = {postMessage() {}};
    });
    await page.evaluate(fs.readFileSync(path.join(__dirname, '../../public/language/caption-sidebar.js'), 'utf8'));
    await page.evaluate(() => {
      const ui = window.__cupShared.createSubtitleUI({shrinkSelectors: ['#movie_player']});
      ui.buildSidebar();
      ui.setVideoElement(document.querySelector('video'));
      window.__cupOpenSubtitlePanel = () => ui.setSplit(true);
      const toggle = document.createElement('button');
      toggle.id = 'cup-youtube-srt-toggle';
      toggle.textContent = 'SRT';
      toggle.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483647';
      toggle.onclick = () => ui.setSplit(false);
      document.body.appendChild(toggle);
    });
    const tick = () => page.evaluate(() => window.captionTicks.forEach(fn => fn()));
    await run(page, tick);
  } finally { await context.close(); }
}

async function videoLayout(page) {
  return page.locator('video').evaluate(video => ({
    height: video.getBoundingClientRect().height,
    wrapperHeight: video.parentElement.getBoundingClientRect().height,
    maxHeight: getComputedStyle(video).maxHeight,
    time: video.currentTime,
  }));
}

test('opening SRT keeps the mobile YouTube video visible through repeated toggles', async () => {
  await boot(async (page, tick) => {
    await page.locator('video').evaluate(video => { video.currentTime = 37; });
    const original = await videoLayout(page);
    assert.equal(original.wrapperHeight, 0, 'exercise the real zero-height parent layout');
    assert.equal(original.height, 219);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__cupOpenSubtitlePanel());
      await tick();
      const open = await videoLayout(page);
      assert.ok(open.height > 0, 'opening SRT must not collapse the video to zero');
      assert.equal(open.time, 37, 'opening SRT must not restart playback');
      assert.equal(await page.locator('.cup-sub-sidebar').isVisible(), true);
      await page.locator('#cup-youtube-srt-toggle').click();
      await tick();
      assert.equal(await page.locator('.cup-sub-sidebar').isVisible(), false);
      assert.deepEqual(await videoLayout(page), original, 'closing restores the original layout and time');
    }
  });
});

test('saved divider height and rotation cap the video against the viewport, not its wrapper', async () => {
  await boot(async (page, tick) => {
    await page.evaluate(() => localStorage.setItem('cupSubVidH', '20'));
    await page.evaluate(() => window.__cupOpenSubtitlePanel());
    for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
      await page.setViewportSize(viewport);
      await tick();
      const open = await videoLayout(page);
      assert.ok(open.height > 0);
      assert.ok(Math.abs(open.height - Math.min(219, viewport.height * 0.2)) < 1);
      assert.ok(Math.abs(parseFloat(open.maxHeight) - viewport.height * 0.2) < 1);
    }
  });
});
