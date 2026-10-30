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
          <video class="html5-main-video" style="width:390px;height:219.375px;left:0;top:0"></video>
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
      // YouTube recalculates inline size/centering when the player changes.
      // Its outer #player still has the original aspect-ratio clipping box.
      const resize = () => {
        const video = document.querySelector('video');
        const width = document.querySelector('#player-container-id').getBoundingClientRect().width;
        const height = width * 9 / 16;
        const playerHeight = document.querySelector('#movie_player').getBoundingClientRect().height;
        Object.assign(video.style, {width: width + 'px', height: height + 'px',
          top: Math.max(0, (playerHeight - height) / 2) + 'px'});
      };
      window.addEventListener('resize', resize);
      const poster = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">' +
        '<rect width="1600" height="900" fill="royalblue"/>' +
        '<rect width="1600" height="80" fill="red"/>' +
        '<rect y="820" width="1600" height="80" fill="lime"/></svg>';
      document.querySelector('video').poster = 'data:image/svg+xml,' + encodeURIComponent(poster);
    });
    for (const name of ['20-caption-sidebar.js', '26-youtube-split-layout.js', '30-caption-sites.js', '70-caption-capture.js']) {
      await page.evaluate(fs.readFileSync((name === '20-caption-sidebar.js' ? path.join(__dirname, '../language/caption-sidebar.js') : path.join(__dirname, 'src', name)), 'utf8'));
    }
    const tick = () => page.evaluate(() => window.captionTicks.forEach(fn => fn()));
    await run(page, tick);
  } finally { await context.close(); }
}

async function pictureBounds(page) {
  return page.locator('video').evaluate(video => {
    const r = video.getBoundingClientRect();
    // The deterministic poster is 16:9. A contained picture may letterbox,
    // but all of it must stay inside every clipping ancestor and the divider.
    const scale = Math.min(r.width / 1600, r.height / 900);
    const width = scale * 1600, height = scale * 900;
    const picture = {left: r.left + (r.width - width) / 2,
      top: r.top + (r.height - height) / 2,
      right: r.left + (r.width + width) / 2,
      bottom: r.top + (r.height + height) / 2};
    const clip = {left: 0, top: 48, right: innerWidth,
      bottom: document.querySelector('.cup-sub-sidebar').getBoundingClientRect().top};
    for (let parent = video.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), box = parent.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(css.overflowX)) {
        clip.left = Math.max(clip.left, box.left);
        clip.right = Math.min(clip.right, box.right);
      }
      if (/hidden|clip|auto|scroll/.test(css.overflowY)) {
        clip.top = Math.max(clip.top, box.top);
        clip.bottom = Math.min(clip.bottom, box.bottom);
      }
    }
    return {picture, clip, fit: getComputedStyle(video).objectFit};
  });
}

async function assertWholePicture(page) {
  const {picture: p, clip: c, fit} = await pictureBounds(page);
  assert.equal(fit, 'contain');
  assert.ok(p.bottom > p.top && p.right > p.left, 'picture has positive area');
  assert.ok(p.left >= c.left - 1 && p.right <= c.right + 1 &&
    p.top >= c.top - 1 && p.bottom <= c.bottom + 1,
    'whole picture must remain visible: ' + JSON.stringify({picture: p, clip: c}));
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
    assert.equal(original.height, 219.375);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.__cupOpenSubtitlePanel());
      await tick();
      const open = await videoLayout(page);
      assert.ok(open.height > 0, 'opening SRT must not collapse the video to zero');
      await assertWholePicture(page);
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
    await tick();
    for (const viewport of [{width: 390, height: 844}, {width: 844, height: 390}]) {
      await page.setViewportSize(viewport);
      await tick();
      const open = await videoLayout(page);
      assert.ok(open.height > 0);
      assert.ok(Math.abs(open.height - (viewport.height * 0.2 - 48)) < 1);
      await assertWholePicture(page);
    }
  });
});

test('dragging the divider up and down keeps the whole picture inside the mobile frame', async () => {
  await boot(async (page, tick) => {
    await page.evaluate(() => window.__cupOpenSubtitlePanel());
    for (const y of [650, 210, 550, 700, 180]) {
      const handle = await page.locator('.cup-sub-drag').boundingBox();
      await page.mouse.move(190, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(190, y, {steps: 4});
      await page.mouse.up();
      await assertWholePicture(page);
      await tick();
      await assertWholePicture(page);
    }
  });
});

test('touch dragging and later inline player rewrites cannot crop the video', async () => {
  await boot(async (page, tick) => {
    await tick();
    for (const y of [220, 690, 300, 560]) {
      await page.locator('.cup-sub-drag').evaluate((handle, y) => {
        const touch = clientY => new Touch({identifier: 1, target: handle, clientX: 190, clientY});
        handle.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, cancelable: true,
          touches: [touch(handle.getBoundingClientRect().top + 6)]}));
        document.dispatchEvent(new TouchEvent('touchmove', {bubbles: true, cancelable: true, touches: [touch(y)]}));
        document.dispatchEvent(new TouchEvent('touchend', {bubbles: true, changedTouches: [touch(y)]}));
        const video = document.querySelector('video');
        Object.assign(video.style, {width: '900px', height: '506px', top: '300px', left: '-80px', transition: 'all 1.5s'});
        video.parentElement.style.transition = 'all 1.5s';
      }, y);
      assert.equal(await page.locator('video').evaluate(video => getComputedStyle(video).transitionDuration), '0s');
      assert.equal(await page.locator('.html5-video-container').evaluate(frame => getComputedStyle(frame).transitionDuration), '0s');
      await assertWholePicture(page);
      await tick();
      await assertWholePicture(page);
    }
  });
});

test('replacement player and teardown do not leave fixed layout rules behind', async () => {
  await boot(async (page, tick) => {
    await tick();
    await page.evaluate(() => {
      const old = document.querySelector('#player-container-id');
      const next = old.cloneNode(true);
      next.classList.remove('cup-youtube-frame');
      for (const p of ['--cup-youtube-top', '--cup-youtube-left', '--cup-youtube-width']) next.style.removeProperty(p);
      old.replaceWith(next);
    });
    await tick();
    await assertWholePicture(page);
    await page.evaluate(() => window.__cupCapsInstalled.teardown());
    assert.equal(await page.locator('.cup-youtube-frame').count(), 0);
    assert.equal(await page.locator('#cup-youtube-split-css').count(), 0);
    assert.equal(await page.locator('body').evaluate(body => body.classList.contains('cup-sub-split')), false);
  });
});
