const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function checkYoutubeReturn(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.setDefaultTimeout(6000)
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => {
        await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
        const s = window.__returnVideo = { state: 2, time: 1, id: 'testVideo01', plays: 0, loads: 0, seeks: 0, rate: 1 }
        window.YT = { PlayerState: { PLAYING: 1 } }
        window.ytPlayer = {
          getIframe: () => document.querySelector('#youtubePlayer'),
          getPlayerState: () => s.state, getCurrentTime: () => s.time, getDuration: () => 1000,
          getVideoData: () => ({ video_id: s.id }), getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
          getPlaybackRate: () => s.rate, setPlaybackRate: r => { s.rate = r },
          playVideo: () => { s.plays++; s.state = 1 }, pauseVideo: () => { s.state = 2 },
          seekTo: t => { s.seeks++; s.time = t },
          loadVideoById: v => { s.loads++; s.id = v.videoId || v; s.time = v.startSeconds || 0; s.state = 1 },
          cueVideoById: v => { s.id = v.videoId; s.time = v.startSeconds || 0; s.state = 5 },
          addEventListener: () => {},
        }
        onPlayerReady({ target: window.ytPlayer })
      })
      const paused = async () => assert.equal(await page.evaluate(() => window.__returnVideo.state), 2)
      // A plain Search interaction must not authorize a parked iframe. Check
      // both unsolicited iframe events and delayed app commands after return.
      for (const event of ['visibilitychange', 'pageshow', 'focus', 'cupitorAppLifecycle', 'statechange']) {
        await page.locator('#searchText').fill('test')
        await page.evaluate(event => {
          window.__returnVideo.state = 1
          if (event === 'visibilitychange') document.dispatchEvent(new Event(event))
          else if (event === 'cupitorAppLifecycle') window.dispatchEvent(new CustomEvent(event, { detail: { isForeground: true } }))
          else if (event === 'statechange') onPlayerStateChange({ data: 1, target: window.ytPlayer })
          else window.dispatchEvent(new Event(event))
          window.ytPlayer.playVideo()
          window.ytPlayer.loadVideoById('staleVideo1')
          window.ytPlayer.seekTo(0, true)
        }, event)
        await paused()
      }
      assert.deepEqual(await page.evaluate(() => [window.__returnVideo.plays, window.__returnVideo.loads, window.__returnVideo.seeks]), [0, 0, 0])
      await page.evaluate(() => window.openPracticeMode({ queue: [{ id: 'testVideo01', source: 'YouTube', timeStart: 1, timeEnd: 3, lineIndex: 0 }] }))
      await page.waitForFunction(() => document.body.classList.contains('practice-mode') && window.__returnVideo.state === 5)
      await page.evaluate(() => window.ytPlayer.playVideo())
      assert.equal(await page.evaluate(() => window.__returnVideo.state), 1)
      await page.evaluate(() => window.minimizePracticeMode())
      await paused()
      await page.evaluate(() => {
        window.__returnVideo.state = 3
        onPlayerStateChange({ data: 3, target: window.ytPlayer })
      })
      await paused()
      await page.evaluate(() => { window.restorePracticeMode(); window.ytPlayer.playVideo() })
      assert.equal(await page.evaluate(() => window.__returnVideo.state), 1)
      await page.evaluate(() => window.closePracticeMode())
      await paused()
      await page.evaluate(() => {
        document.body.classList.add('rec-playing')
        window.ytPlayer.playVideo()
      })
      assert.equal(await page.evaluate(() => window.__returnVideo.state), 1)
      await page.evaluate(() => document.body.classList.remove('rec-playing'))
      await paused() // closing/hiding is enforced even without a player event
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: Search, return events, late commands, Practice minimize/restore and Player closure stay in sync`)
    } finally { await page.close() }
  }
}
module.exports = { checkYoutubeReturn }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkYoutubeReturn(browser) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
