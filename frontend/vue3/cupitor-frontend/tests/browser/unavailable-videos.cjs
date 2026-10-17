const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function checkUnavailableVideos(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, hasTouch: mobile, isMobile: mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
    page.setDefaultTimeout(6000)
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => {
      window.dontConfirmOnRefresh = true
      window.__lifecycleRequests = []
      window.AppLifecycleBridge = { postMessage: message => {
        window.__lifecycleRequests.push(message)
        // A synchronous reply proves the listener was registered first.
        window.dispatchEvent(new CustomEvent('cupitorAppLifecycle', { detail: { isForeground: false } }))
      } }
    })
    const foreground = value => page.evaluate(value => {
      window.dispatchEvent(new CustomEvent('cupitorAppLifecycle', { detail: { isForeground: value } }))
    }, value)
    const at = index => page.waitForFunction(index => window._recPlayIndex === index &&
      window._recPlayCurrentItem === window._recPlayQueue?.[index] &&
      window.__video.requested === window._recPlayQueue[index].id && !window._recNavRequest && window._recNavGotoIndex == null, index)
    const click = async selector => {
      // Keyboard input reveals the existing controls, without activating them.
      await page.keyboard.press('Shift')
      if (mobile) await page.locator(selector).tap()
      else await page.locator(selector).click()
    }
    const start = async (mode = 'buffering', extra = {}) => {
      await page.evaluate(({ mode, extra }) => {
        Object.assign(window._appSettings, { recPlayShuffle: false, recPlayLoop: extra.loop || 'off', recPlayGapSeconds: 30 })
        const s = window.__video = { mode, id: 'testVideo01', requested: null, time: 0, state: 2, loads: [], events: [], rate: 1 }
        const bad = 'testVideo02'
        window.ytPlayer = {
          getVideoData: () => ({ video_id: s.id }), getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
          getIframe: () => document.getElementById('youtubePlayer'), getCurrentTime: () => s.time,
          getPlayerState: () => s.state, getDuration: () => 1000,
          getPlaybackRate: () => s.rate, setPlaybackRate: r => { s.rate = r },
          pauseVideo: () => { s.state = 2; s.events.push(['pause', s.requested]) },
          playVideo: () => { if (s.requested !== bad) s.state = 1; s.events.push(['play', s.requested]) },
          seekTo: t => { if (s.requested !== bad || s.mode === 'recovered') s.time = t; s.events.push(['seek', s.requested, t]) },
          cueVideoById: v => { s.id = v.videoId; s.requested = v.videoId; s.time = v.startSeconds || 0; s.state = 5 },
          loadVideoById: v => {
            const id = typeof v === 'string' ? v : v.videoId
            s.requested = id; s.loads.push(id); s.events.push(['load', id])
            if (id !== bad || s.mode === 'recovered') { s.id = id; s.time = v.startSeconds || 0; s.state = 1; return }
            s.id = s.mode === 'stale-id' ? 'testVideo01' : id
            s.time = s.mode === 'paused-stale' ? 1 : 0
            s.state = s.mode === 'paused-stale' ? 2 : 3
            if (s.mode.startsWith('error-')) queueMicrotask(() => window.handleYoutubePlayerError(Number(s.mode.slice(6)), window.ytPlayer))
          },
          addEventListener: () => {}
        }
        window.ytPlayerReady = mode !== 'not-ready'
        const queue = Array.from({ length: extra.small ? 2 : 145 }, (_, i) => ({
          id: (extra.allBad || i === 99 || (extra.duplicate && i === 100)) ? bad : i < 99 ? 'testVideo01' : 'testVideo03',
          source: 'YouTube', searchText: i === 99 ? 'räkna med' : 'test', timeStart: 1, timeEnd: 3, lineIndex: 1,
          _recName: 'Tillåt mig tvivla - Ord', _st: 'räkna med', _w: 'räkna med', _idx: i
        }))
        window.__videoTask = window.playRecording({ resumeQueue: { queue, pos: extra.small ? 0 : 99 } })
      }, { mode, extra })
    }
    const stop = async () => {
      await page.evaluate(() => window.stopPlayingRecording())
      await page.clock.runFor(400)
      await page.evaluate(() => window.__videoTask)
      await page.waitForFunction(() => !window._playingRecording)
    }
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      await page.clock.install()

      assert.deepEqual(await page.evaluate(() => window.__lifecycleRequests), ['getState'])
      await start('not-ready')
      await page.waitForFunction(() => window._recVideoAttempt?.requested)
      await page.clock.fastForward(60000)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 99, 'initial background state freezes readiness/recovery')
      await foreground(true)
      await page.evaluate(() => { window.ytPlayerReady = true })
      await at(99)
      await stop()

      // Foreground-only budgets survive a fully suspended JS runtime: no
      // intermediate ticks run between the background and foreground events.
      for (const mode of ['stale-id', 'not-ready']) {
        await start(mode)
        await page.waitForFunction(() => window._recVideoAttempt?.requested)
        await page.clock.fastForward(5000)
        await foreground(false)
        const wall = await page.evaluate(() => Date.now())
        await page.clock.setSystemTime(wall + 120000)
        await foreground(true)
        if (mode === 'not-ready') await page.evaluate(() => { window.ytPlayerReady = true })
        await page.clock.fastForward(14000)
        assert.equal(await page.evaluate(() => window._recPlayIndex), 99, mode + ': background must not spend the recovery budget')
        await page.clock.fastForward(1500)
        await at(100)
        assert.equal(await page.evaluate(() => window._recPlayPaused), false, 'lifecycle does not change explicit Pause')
        await stop()
      }

      await start('recovered')
      await at(99)
      await page.clock.runFor(500)
      await page.evaluate(() => { window.__video.time = 1.2 })
      await page.clock.runFor(200)
      await page.evaluate(() => { window.__video.time = 3 })
      await page.waitForFunction(() => window._recPlayGapActive)
      await page.clock.runFor(1000)
      await foreground(false)
      const gapText = await page.locator('#recPlayingBanner .rec-pb-count').innerText()
      await page.clock.fastForward(60000)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 99)
      assert.equal(await page.locator('#recPlayingBanner .rec-pb-count').innerText(), gapText, 'visible gap countdown freezes')
      await foreground(true)
      await page.clock.fastForward(27000)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 99, 'returning must not catch up background gap time')
      await page.clock.fastForward(2500)
      await at(100)
      await stop()

      // Reproduce #100/145 while loading a video that never acknowledges it.
      await start('stale-id')
      await at(99)
      await click('#recPlayingPrevBtn')
      await at(98)
      await page.clock.runFor(500)
      assert.equal(await page.evaluate(() => window.__video.state), 1, 'a cancelled attempt cannot pause the previous item after it starts')
      // An error delivered late by the old video cannot skip the healthy one.
      await page.evaluate(() => window.handleYoutubePlayerError(100, { getVideoData: () => ({ video_id: 'testVideo02' }) }))
      await page.clock.runFor(500)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 98)
      await stop()

      await start('paused-stale')
      await at(99)
      const loads = await page.evaluate(() => window.__video.loads.length)
      await click('.rec-pb-replay-btn')
      await page.waitForFunction(n => window.__video.loads.length > n, loads)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 99, 'Replay retries this item')
      // This error screen never reaches a verified clip position. Playback
      // speed is applied after confirmation; Next must still work now.
      await click('#recPlayingNextBtn')
      await at(100)
      await stop()

      // A codec error after real playback can leave the iframe PAUSED.
      // That error screen must not be mistaken for a deliberate headset pause.
      await start('recovered')
      await at(99)
      await page.clock.runFor(500)
      await page.evaluate(() => { window.__video.time = 1.2 })
      await page.clock.runFor(200)
      assert.equal(await page.evaluate(() => window._recVideoAttempt.played), true)
      await page.evaluate(() => {
        window.__video.state = 2
        window.handleYoutubePlayerError(5, window.ytPlayer)
      })
      await page.clock.fastForward(20500)
      await at(100)
      assert.equal(await page.evaluate(() => window._recPlayPaused), false)
      await stop()

      await start('stale-id')
      await at(99)
      await click('#recPlayingQueueBtn')
      await click('.pqd-play[data-idx="5"]')
      await at(5)
      await stop()

      // One shared budget covers stale IDs, buffering, paused error screens
      // and an iframe API that never becomes ready. No ordinary 30s gap follows.
      for (const mode of ['stale-id', 'buffering', 'paused-stale', 'not-ready', 'error-5']) {
        await start(mode)
        if (mode !== 'not-ready') await at(99)
        else await page.waitForFunction(() => window._recPlayCurrentItem === window._recPlayQueue?.[99])
        await page.clock.fastForward(19000)
        assert.equal(await page.evaluate(() => window._recPlayIndex), 99, mode + ': no premature skip')
        assert.equal(await page.evaluate(() => window._recPlayPaused), false, mode + ': error screen is not a user pause')
        await page.clock.fastForward(1500)
        if (mode === 'not-ready') await page.evaluate(() => { window.ytPlayerReady = true })
        await at(100)
        await stop()
      }

      // Confirmed errors skip immediately, even two clips from the same video.
      for (const code of [100, 101, 150, 2, 153]) {
        await start('error-' + code, { duplicate: true })
        await at(101)
        assert.equal(await page.evaluate(() => window._recPlayPaused), false)
        await stop()
      }

      // Deliberate Pause freezes recovery; Previous still leaves it promptly.
      await start('buffering')
      await at(99)
      await click('#recPlayingPauseBtn')
      await page.clock.fastForward(30000)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 99)
      assert.equal(await page.evaluate(() => window._recPlayPaused), true)
      await click('#recPlayingPrevBtn')
      await at(98)
      await stop()

      // Recoverable errors are not permanently blacklisted: genuine progress
      // can still finish the clip and use the ordinary inter-item gap.
      await start('error-5')
      await at(99)
      await page.clock.runFor(1000)
      await page.evaluate(() => { window.__video.mode = 'recovered'; window.__video.state = 1; window.__video.time = 1 })
      await page.clock.runFor(200)
      await page.evaluate(() => { window.__video.time = 1.2 })
      await page.clock.runFor(200)
      assert.equal(await page.evaluate(() => window._recVideoAttempt.played), true)
      await page.evaluate(() => { window.__video.time = 3 })
      await page.waitForFunction(() => window._recPlayGapActive)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 99)
      await click('#recPlayingNextBtn')
      await at(100)
      await stop()

      await start('error-100', { loop: 'one' })
      await at(100)
      await stop()
      await start('error-100', { allBad: true, small: true, loop: 'playlist' })
      await page.waitForFunction(() => !window._playingRecording)
      await page.evaluate(() => window.__videoTask)
      assert.equal(await page.evaluate(() => window.__video.loads.length), 2, 'all-broken queues stop after one pass')

      // Stop and immediately replace a cold load: old cleanup must not close
      // the new Player or let its obsolete load autoplay later.
      await start('not-ready')
      await page.waitForFunction(() => window._recVideoAttempt?.requested)
      await page.evaluate(() => { window.stopPlayingRecording(); window.__oldVideoTask = window.__videoTask })
      await start('recovered')
      await at(99)
      await page.clock.runFor(500)
      await page.evaluate(() => window.__oldVideoTask)
      assert.equal(await page.evaluate(() => window._playingRecording), true)
      assert.equal(await page.locator('#recPlayingBanner').isVisible(), true)
      await stop()
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: #100/145 unavailable-video navigation, retry, 20s recovery, lifecycle timers, error isolation, pause, loops and stop/restart passed`)
    } catch (error) {
      console.error(await page.evaluate(() => ({ video: window.__video, index: window._recPlayIndex,
        playing: window._playingRecording, paused: window._recPlayPaused, nav: window._recNavRequest,
        attempt: window._recVideoAttempt && { active: window._recVideoAttempt.active(), requested: window._recVideoAttempt.requested },
        text: document.querySelector('#recPlayingSubs')?.textContent })))
      console.error(errors)
      throw error
    } finally { await page.close() }
  }
}
module.exports = { checkUnavailableVideos }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkUnavailableVideos(browser) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
