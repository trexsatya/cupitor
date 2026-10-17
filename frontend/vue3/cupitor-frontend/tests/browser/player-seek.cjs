const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function checkPlayerSeek(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    page.setDefaultTimeout(6000)
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
    await page.route('**/*', route => {
      if (new URL(route.request().url()).pathname.endsWith('.srt')) return route.fulfill({ contentType: 'text/plain',
        body: '1\n00:02:00,000 --> 00:02:03,000\nräkna med\n\n2\n00:03:00,000 --> 00:03:03,000\nnästa\n' })
      return serveFixtures(route)
    })
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    const click = async selector => {
      await page.keyboard.press('Shift')
      if (mobile) await page.locator(selector).tap()
      else await page.locator(selector).click()
    }
    const start = async (mode, options = {}) => page.evaluate(({ mode, options }) => {
      Object.assign(window._appSettings, { recPlayShuffle: false, recPlayLoop: 'off', recPlayGapSeconds: 30 })
      const s = window.__seek = { mode, id: 'testVideo01', time: 0, state: 2, rate: 1, muted: !!options.muted,
        loads: [], seeks: {}, events: [], audible: [] }
      const log = action => {
        s.events.push({ action, id: s.id, time: s.time, muted: s.muted })
        if (s.state === 1 && !s.muted) s.audible.push({ action, id: s.id, time: s.time })
      }
      window.ytPlayer = {
        getVideoData: () => ({ video_id: s.id }), getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
        getIframe: () => document.getElementById('youtubePlayer'), getCurrentTime: () => s.time,
        getPlayerState: () => s.state, getDuration: () => 1000,
        getPlaybackRate: () => s.rate, setPlaybackRate: rate => { s.rate = rate },
        isMuted: () => s.muted, mute: () => { s.muted = true; log('mute') }, unMute: () => { s.muted = false; log('unmute') },
        pauseVideo: () => { s.state = 2; log('pause') }, playVideo: () => { s.state = 1; log('play') },
        seekTo: target => {
          s.seeks[target] = (s.seeks[target] || 0) + 1
          const broken = s.id === 'testVideo02' &&
            (s.mode === 'never' || s.mode === 'buffering' || (s.mode === 'retry' && s.seeks[target] < 3) ||
              (s.mode === 'reload' && s.loads.filter(v => v.videoId === s.id).length < 2))
          if (!broken) s.time = target
          log('seek')
        },
        loadVideoById: value => {
          s.loads.push(value); s.id = value.videoId; s.state = 1
          const first = s.id === 'testVideo02' && s.loads.filter(v => v.videoId === s.id).length === 1
          s.time = s.id === 'testVideo02' && (s.mode === 'never' || s.mode === 'retry' || (s.mode === 'reload' && first)) ? 0 : value.startSeconds || 0
          if (s.mode === 'buffering' && s.id === 'testVideo02') s.state = 3
          if (s.mode === 'paused-load') s.state = 2
          log('load')
        },
        addEventListener: () => {}
      }
      window.ytPlayerReady = true
      const queue = [
        { id: 'testVideo02', source: 'YouTube', searchText: 'räkna med', timeStart: 120, timeEnd: 123, lineIndex: 0 },
        { id: options.sameVideo ? 'testVideo02' : 'testVideo03', source: 'YouTube', searchText: 'nästa', timeStart: 180, timeEnd: 183, lineIndex: 1 },
      ]
      window.__seekTask = window.playRecording({ resumeQueue: { queue, pos: 0 } })
    }, { mode, options })
    const loaded = () => page.waitForFunction(() => window.__seek.loads.length > 0)
    const ready = (index = 0) => page.waitForFunction(index => window._recPlayIndex === index && !window.seekRequestProcessing &&
      window.__seek.time === (index ? 180 : 120) && window.__seek.state === 1 &&
      window.__seek.events.some(e => e.action === 'play' && e.time === (index ? 180 : 120)), index)
    const stop = async () => {
      await page.evaluate(() => window.stopPlayingRecording())
      await page.clock.runFor(400)
      await page.evaluate(() => window.__seekTask)
    }
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      await page.clock.install()
      for (const mode of ['retry', 'reload', 'paused-load']) {
        await start(mode)
        await loaded()
        await page.clock.runFor(mode === 'retry' ? 2300 : 3400)
        await ready()
        assert.deepEqual(await page.evaluate(() => window.__seek.audible.filter(e => e.id === 'testVideo02' && e.time < 119.5)), [], 'video zero must stay silent')
        assert.equal(await page.evaluate(() => window.__seek.muted), false)
        if (mode === 'reload') assert((await page.evaluate(() => window.__seek.loads.length)) >= 2, 'ignored seeks reload at startSeconds')
        await stop()
      }

      await start('never')
      await loaded()
      await page.clock.fastForward(19000)
      assert.equal(await page.evaluate(() => window._recPlayIndex), 0)
      assert.equal(await page.evaluate(() => window.__seek.muted), true)
      assert.deepEqual(await page.evaluate(() => window.__seek.audible), [])
      await page.clock.fastForward(1500)
      await ready(1)
      assert.deepEqual(await page.evaluate(() => window.__seek.audible.filter(e => e.id === 'testVideo02')), [], 'failed clip is skipped instead of playing its beginning')
      await stop()

      // A cached target timestamp while BUFFERING is not a settled seek.
      await start('buffering')
      await loaded()
      await page.clock.runFor(1000)
      assert.equal(await page.evaluate(() => window.__seek.muted), true)
      assert.deepEqual(await page.evaluate(() => window.__seek.audible), [])
      await page.evaluate(() => { window.__seek.mode = 'good'; window.__seek.state = 1 })
      await ready()
      await stop()

      // Navigation and Stop cancel retries without later seek/unmute/pause
      // commands leaking into the replacement item or Practice.
      await start('never')
      await loaded()
      await click('#recPlayingNextBtn')
      await ready(1)
      await page.clock.runFor(3500)
      assert.equal(await page.evaluate(() => window.__seek.time), 180)
      assert.equal(await page.evaluate(() => window.__seek.state), 1)
      await stop()
      await start('never')
      await loaded()
      await stop()
      const commands = await page.evaluate(() => window.__seek.events.length)
      await page.clock.runFor(4000)
      assert.equal(await page.evaluate(() => window.__seek.events.length), commands)
      assert.equal(await page.evaluate(() => window.__seek.state), 2)

      await start('good', { muted: true, sameVideo: true })
      await ready()
      assert.equal(await page.evaluate(() => window.__seek.muted), true, 'preserve intentional mute')
      await page.evaluate(() => { window.__seek.time = 120.2 })
      await page.clock.runFor(200)
      await click('#recPlayingNextBtn')
      await ready(1)
      assert.equal(await page.evaluate(() => window.__seek.loads.length), 1, 'same-video clips seek without redundant loads')
      assert.equal(await page.evaluate(() => window.__seek.muted), true)
      await stop()
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: verified Player seeks, retries/reloads, silent preparation, 20s skip, cancellation, same-video clips and mute preservation passed`)
    } catch (error) {
      console.error(await page.evaluate(() => ({ seek: window.__seek, index: window._recPlayIndex, paused: window._recPlayPaused, seeking: window.seekRequestProcessing })))
      throw error
    } finally { await page.close() }
  }
}
module.exports = { checkPlayerSeek }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkPlayerSeek(browser) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
