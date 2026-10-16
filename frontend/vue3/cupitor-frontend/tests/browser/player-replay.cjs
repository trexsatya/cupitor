const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')

function silentWav() {
  const bytes = 8000 * 2 * 10
  const wav = Buffer.alloc(44 + bytes)
  wav.write('RIFF'); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28)
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34)
  wav.write('data', 36); wav.writeUInt32LE(bytes, 40)
  return 'data:audio/wav;base64,' + wav.toString('base64')
}

async function checkControlLayout(page) {
  const original = page.viewportSize()
  assert.deepEqual(await page.locator('#recPlayingTransport > button').evaluateAll(els => els.map(el => el.id)),
    ['recPlayingShuffleBtn', 'recPlayingPrevBtn', 'recPlayingPauseBtn', 'recPlayingQueueBtn',
      'recPlayingSearchBtn', 'recPlayingNextBtn', 'recPlayingLoopBtn'])
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 900], [480, 900], [768, 900], [844, 390], [1280, 900]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const controls = await page.evaluate(() => {
      const ids = ['recPlayingShuffleBtn', 'recPlayingPrevBtn', 'recPlayingPauseBtn', 'recPlayingQueueBtn',
        'recPlayingSearchBtn', 'recPlayingNextBtn', 'recPlayingLoopBtn', 'recPlayingMinimizeBtn', 'recPlayingCloseBtn']
      const buttons = ids.map(id => document.getElementById(id))
        .concat([...document.querySelectorAll('#recPlayingBanner button')].filter(el => el.getClientRects().length))
      return buttons.map(el => {
        const r = el.getBoundingClientRect()
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return { name: el.getAttribute('aria-label'), x: r.x, y: r.y, width: r.width, height: r.height,
          visible: !!el.getClientRects().length, reachable: !!hit && (hit === el || el.contains(hit)) }
      })
    })
    for (const c of controls) {
      assert(c.visible && c.width > 0 && c.height > 0, `${width}×${height}: ${c.name} must be visible`)
      assert(c.x >= 0 && c.y >= 0 && c.x + c.width <= width + 0.5 && c.y + c.height <= height + 0.5,
        `${width}×${height}: ${c.name} leaves the viewport: ${JSON.stringify(c)}`)
      assert(c.reachable, `${width}×${height}: ${c.name} is covered by another element`)
    }
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      const a = controls[i], b = controls[j]
      const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
      assert(overlapX <= 0.5 || overlapY <= 0.5, `${width}×${height}: ${a.name} overlaps ${b.name}`)
    }
  }
  await page.setViewportSize(original)
}

async function checkPlayerReplay(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
    page.setDefaultTimeout(15000)
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    const replay = () => mobile ? page.getByRole('button', { name: 'Replay current item' }).tap()
      : page.getByRole('button', { name: 'Replay current item' }).click()
    const seekCount = () => page.evaluate(() => window.__yt.events.filter(e => e.action === 'seek' && e.time === 1).length)
    const finishAudio = () => page.evaluate(() => {
      const audio = window._recPlayManualAudio
      audio.currentTime = audio.duration
      audio.dispatchEvent(new Event('ended'))
    })
    const waitFace = label => page.waitForFunction(label => document.querySelector('#recPlayingAudio .rec-pa-face')?.textContent === label &&
      window._recPlayManualAudio && !window._recPlayManualAudio.paused, label)
    const stop = async () => {
      await page.locator('#recPlayingCloseBtn').click()
      await page.evaluate(() => window.__playerTask)
      assert.equal(await page.locator('.rec-pb-replay-btn').count(), 0)
    }
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._subtitlesReadyPromise, window._vocabularyReadyPromise]))
      await page.evaluate(wav => {
        const s = window.__yt = { id: 'testVideo01', time: 0, state: 2, events: [] }
        const log = action => s.events.push({ action, time: s.time, id: s.id })
        window.ytPlayer = {
          pauseVideo: () => { s.state = 2; log('pause') }, playVideo: () => { s.state = 1; log('play') },
          loadVideoById: value => { s.id = typeof value === 'string' ? value : value.videoId; s.time = value.startSeconds || 0; s.state = 1; log('load') },
          cueVideoById: value => { s.id = value.videoId; s.time = value.startSeconds || 0; s.state = 5 },
          seekTo: time => { s.time = time; log('seek') }, getCurrentTime: () => s.time,
          getPlayerState: () => s.state, getVideoData: () => ({ video_id: s.id }), getDuration: () => 1000,
          getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id, getIframe: () => document.getElementById('youtubePlayer'),
          setPlaybackRate: () => {}, getPlaybackRate: () => 1, addEventListener: () => {}
        }
        window.ytPlayerReady = true
        window.__audioLoads = []
        window.AudioBridge = { postMessage: message => {
          const request = JSON.parse(message)
          if (request.op === 'load') window.__audioLoads.push(request.url)
          queueMicrotask(() => window.__cupAudio({ rid: request.rid, result: wav }))
        } }
        Object.assign(window._appSettings, { recPlayGapSeconds: 30, recPlaySrcTgtGapSeconds: 30,
          recPlayShuffle: false, recPlayLoop: 'off', recPlayReverse: false })
        const queue = [
          { id: 'testVideo01', source: 'YouTube', searchText: 'färgsprakande', timeStart: 1, timeEnd: 3, lineIndex: 1 },
          { id: 'testVideo02', source: 'YouTube', searchText: 'hagla', timeStart: 3, timeEnd: 5, lineIndex: 2 }
        ]
        window.__playerTask = window.playRecording({ queue, startPaused: true })
      }, silentWav())
      await checkControlLayout(page)

      // Replay starts a paused item, resets a playing/paused clip to its
      // own start (not video zero), and keeps the queue index unchanged.
      await replay()
      await page.waitForFunction(() => window.__yt.time === 1 && window.__yt.state === 1)
      assert.equal(await page.evaluate(() => window._recPlayPaused), false)
      for (const paused of [false, true]) {
        await page.evaluate(() => { window.__yt.time = 2 })
        if (paused) await page.locator('#recPlayingPauseBtn').click()
        const before = await seekCount()
        await replay()
        await page.waitForFunction(before => window.__yt.events.filter(e => e.action === 'seek' && e.time === 1).length > before && window.__yt.state === 1, before)
        await page.waitForTimeout(120) // catches the old clip's delayed pause
        assert.equal(await page.evaluate(() => window.__yt.state), 1)
        assert.equal(await page.evaluate(() => window._recPlayIndex), 0)
      }
      await page.evaluate(() => { window.__yt.time = 3 })
      await page.waitForFunction(() => window._recPlayGapActive)
      const beforeGapReplay = await seekCount()
      await replay()
      await page.waitForFunction(before => window.__yt.events.filter(e => e.action === 'seek' && e.time === 1).length > before && window.__yt.state === 1, beforeGapReplay)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 0, 'gap replay cannot briefly start the next item')
      assert.equal(await page.evaluate(() => window.__yt.events.some(e => e.id === 'testVideo02')), false)
      const bounds = await page.getByRole('button', { name: 'Replay current item' }).boundingBox()
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= (mobile ? 390 : 1280))
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cupitor-player-replay-${mobile ? 'mobile' : 'desktop'}.png`) })
      }
      await stop()
      assert.equal(await page.locator('#recPlayingTransport').count(), 0)

      // A dual recording restarts from Source, including when waiting for
      // Target, playing Target, or paused. A reference video stays silent.
      await page.evaluate(() => {
        window.__yt.events = []
        window.__playerTask = window.playRecording({ queue: [{ manual: true, id: 'manual-replay', source: 'Hej', target: 'Hello',
          sourceAudioUrl: 'file:///source.wav', targetAudioUrl: 'file:///target.wav' }] })
      })
      await waitFace('Source')
      await finishAudio()
      await page.waitForFunction(() => window._recPlayGapActive)
      const loads = await page.evaluate(() => window.__audioLoads.length)
      await replay()
      await waitFace('Source')
      assert.equal(await page.evaluate(() => window.__audioLoads.length), loads + 1)
      await page.evaluate(() => { window._appSettings.recPlaySrcTgtGapSeconds = 0 })
      await finishAudio()
      await waitFace('Target')
      await page.locator('#recPlayingPauseBtn').click()
      await replay()
      await waitFace('Source')
      assert.equal(await page.evaluate(() => window._recPlayIndex), 0)
      assert.equal(await page.evaluate(() => window._recPlayPaused), false)
      assert.equal(await page.evaluate(() => window.__yt.events.some(e => e.action === 'play' || e.action === 'load')), false)
      await page.locator('#recPlayingMinimizeBtn').click()
      assert.equal(await page.locator('.rec-pb-replay-btn:visible').count(), 0)
      await page.locator('.rec-pill-restore').click()
      assert.equal(await page.locator('.rec-pb-replay-btn:visible').count(), 1)
      await stop()
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: Player Replay resets video/manual cards during playback, pause and gaps without advancing the queue`)
    } catch (error) {
      console.error(await page.evaluate(() => ({ player: window.__yt, playing: window._playingRecording,
        paused: window._recPlayPaused, index: window._recPlayIndex, goto: window._recNavGotoIndex, item: window._recPlayCurrentItem, errors: window.__playerError })))
      throw error
    } finally { await page.close() }
  }
}
module.exports = { checkPlayerReplay, silentWav }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkPlayerReplay(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
