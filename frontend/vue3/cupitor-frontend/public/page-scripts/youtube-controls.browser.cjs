const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {test, before, after} = require('node:test');
const {chromium} = require('playwright');

const snippet = fs.readFileSync(path.join(__dirname, 'snippet.js'), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({
  executablePath: process.env.CUPITOR_CHROME_PATH,
  headless: true, args: ['--no-sandbox'],
}); });
after(async () => { await browser?.close(); });

function fixture(mobile) {
  const media = '<div class="html5-video-container"><video style="width:100%;height:219px"></video></div>';
  const controls = `<div id="player-control-overlay" data-open="false">
    <div class="native-bar">
      <button id="play">Play/pause</button><button id="mute">Mute</button>
      <button id="volume-open">Volume</button>
      <input id="seek" aria-label="Seek" type="range" min="0" max="100" value="0">
      <button id="settings">Settings</button><button id="fullscreen">Fullscreen</button>
    </div></div>`;
  return `<!doctype html><html><head><style>
    body {margin:0;background:#222;color:white}
    .player-container {position:fixed;top:48px;left:0;right:0;overflow:hidden;z-index:2}
    .player-size {position:relative;width:100%;padding-bottom:56.25%;overflow:hidden}
    .html5-video-player {position:absolute;inset:0;height:100%;background:black;z-index:0}
    .html5-video-container {position:relative;z-index:10}
    video {position:absolute;top:0;left:0}
    #desktop-shell {margin-top:48px}
    #desktop-shell #movie_player {position:relative;height:500px;width:100%}
    #player-control-overlay {position:absolute;inset:0}
    #desktop-shell #player-control-overlay {z-index:60}
    #player-control-overlay[data-open="false"] {display:none}
    .native-bar {position:absolute;bottom:8px;left:8px;right:8px;display:flex;flex-wrap:wrap;gap:6px}
    .native-bar button,.native-bar input {height:32px;box-sizing:border-box}
    .native-bar input {width:100px}
    .native-popup {display:none;position:fixed;left:16px;top:100px;width:280px;height:90px;
      padding:12px;background:#555;z-index:10000}
    .native-popup input {width:240px;height:32px}
  </style></head><body>${mobile ?
    `<div id="player-container-id" class="player-container"><div id="player" class="player-size">
      <div id="movie_player" class="html5-video-player">${media}</div></div>
      <div id="player-control-container">${controls}</div></div>` :
    `<div id="desktop-shell"><div id="movie_player" class="html5-video-player">${media}${controls}</div></div>`}
    <div id="volume-popup" class="native-popup"><input id="volume" aria-label="Volume" type="range" min="0" max="1" step="0.01" value="0.5"></div>
    <div id="settings-popup" class="native-popup"><button id="quality">720p</button></div>
  </body></html>`;
}

// Use actual browser hit testing and pointer/touch input. Programmatic click()
// would bypass the invisible-wrapper and stacking regressions being tested.
async function press(page, selector, touch, fraction = 0.5) {
  const target = page.locator(selector);
  const box = await target.boundingBox();
  assert.ok(box, selector + ' is rendered');
  const point = {x: box.x + box.width * fraction, y: box.y + box.height / 2};
  const hit = await target.evaluate((element, p) => {
    const receiver = document.elementFromPoint(p.x, p.y);
    return {ok: element === receiver || element.contains(receiver),
      receiver: receiver && (receiver.tagName + '#' + receiver.id)};
  }, point);
  assert.ok(hit.ok, `${selector} must receive input, intercepted by ${hit.receiver}`);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

for (const mobile of [true, false]) {
  test(`${mobile ? 'mobile touch' : 'desktop mouse'} can operate YouTube controls before/after resizing and closing`, async () => {
    const context = await browser.newContext({viewport: mobile ? {width:390,height:844} : {width:1280,height:800}, hasTouch: mobile});
    try {
      const page = await context.newPage();
      await page.route('**/*', route => route.fulfill({contentType:'text/html',body:fixture(mobile)}));
      await page.goto(`https://${mobile ? 'm' : 'www'}.youtube.com/watch?v=abcdefghijk`);
      await page.evaluate(() => {
        window.ticks = [];
        window.setInterval = fn => window.ticks.push(fn);
        window.YouTubeSubtitles = {postMessage() {}};
        window.actions = [];
        const video = document.querySelector('video');
        const overlay = document.querySelector('#player-control-overlay');
        video.volume = 0.5;
        video.addEventListener('click', () => { overlay.dataset.open = 'true'; });
        for (const id of ['play','mute','fullscreen','quality']) {
          document.getElementById(id).onclick = () => {
            window.actions.push(id);
            if (id === 'mute') video.muted = !video.muted;
          };
        }
        for (const [button, popup] of [['volume-open','volume-popup'],['settings','settings-popup']]) {
          document.getElementById(button).onclick = () => {
            document.getElementById(popup).style.display = 'block';
          };
        }
        document.getElementById('volume').oninput = event => { video.volume = +event.target.value; };
        document.getElementById('seek').oninput = event => { video.currentTime = +event.target.value; };
      });
      await page.evaluate(snippet);
      await page.evaluate(() => window.ticks.forEach(fn => fn()));
      for (const phase of ['open','resized','closed']) {
        if (phase === 'resized') {
          const handle = await page.locator('.cup-sub-drag').boundingBox();
          await page.mouse.move(190, handle.y + 6);
          await page.mouse.down(); await page.mouse.move(190, 550); await page.mouse.up();
        }
        if (phase === 'closed') await page.locator('#cup-youtube-srt-toggle').click();
        await page.evaluate(() => {
          document.querySelector('#player-control-overlay').dataset.open = 'false';
          window.actions = [];
        });
        await press(page, 'video', mobile);
        assert.equal(await page.locator('#player-control-overlay').getAttribute('data-open'), 'true');
        await press(page, '#play', mobile);
        const muted = await page.locator('video').evaluate(video => video.muted);
        await press(page, '#mute', mobile);
        assert.equal(await page.locator('video').evaluate(video => video.muted), !muted);
        await press(page, '#seek', mobile, 0.75);
        assert.ok(await page.locator('video').evaluate(video => video.currentTime > 60));
        await press(page, '#volume-open', mobile);
        await press(page, '#volume', mobile, 0.75);
        assert.ok(await page.locator('video').evaluate(video => video.volume > 0.6));
        await page.locator('#volume-popup').evaluate(popup => { popup.style.display = 'none'; });
        await press(page, '#settings', mobile);
        await press(page, '#quality', mobile);
        await page.locator('#settings-popup').evaluate(popup => { popup.style.display = 'none'; });
        await press(page, '#fullscreen', mobile);
        assert.deepEqual(await page.evaluate(() => window.actions), ['play','mute','quality','fullscreen']);
      }
    } finally { await context.close(); }
  });
}
