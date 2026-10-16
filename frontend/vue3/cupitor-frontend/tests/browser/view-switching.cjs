const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function checkViewSwitching(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const errors = []
    page.setDefaultTimeout(15000)
    page.on('pageerror', error => errors.push(error.message))
    page.on('dialog', dialog => { errors.push(dialog.message()); dialog.dismiss() })
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    const switchTo = name => mobile ? page.getByRole('button', { name: 'Switch to ' + name, exact: true }).tap()
      : page.getByRole('button', { name: 'Switch to ' + name, exact: true }).click()
    const practiceAt = index => page.waitForFunction(index => window._practiceActive && window._practiceIdx === index &&
      !document.querySelector('#practiceMode .practice-loading'), index)
    const playerAt = index => page.waitForFunction(index => !window._practiceActive && window._playingRecording &&
      window._recPlayIndex === index && window._recPlayCurrentItem === window._recPlayQueue[index] && window._recNavGotoIndex == null, index)
    const order = () => page.evaluate(() => (window._practiceActive ? window._practiceCards : window._recPlayQueue)
      .map(item => item.id + ':' + (item.timeStart || 0)))
    const expected = ['testVideo02:3', 'recorded-card:0', 'testVideo01:5', 'text-only:0', 'testVideo01:1']
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      await page.evaluate(wav => {
        const s = window.__yt = { id: 'testVideo01', time: 0, state: 2, events: [] }
        const log = action => s.events.push({ action, id: s.id, time: s.time })
        window.ytPlayer = {
          pauseVideo: () => { s.state = 2; log('pause') }, playVideo: () => { s.state = 1; log('play') },
          loadVideoById: value => { s.id = typeof value === 'string' ? value : value.videoId; s.time = value.startSeconds || 0; s.state = 1; log('load') },
          cueVideoById: value => { s.id = value.videoId; s.time = value.startSeconds || 0; s.state = 5; log('cue') },
          seekTo: time => { s.time = time; log('seek') }, getCurrentTime: () => s.time,
          getPlayerState: () => s.state, getVideoData: () => ({ video_id: s.id }), getDuration: () => 1000,
          getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id, getIframe: () => document.getElementById('youtubePlayer'),
          setPlaybackRate: () => {}, getPlaybackRate: () => 1, getAvailablePlaybackRates: () => [0.5, 0.75, 1], addEventListener: () => {}
        }
        window.ytPlayerReady = true
        window.AudioBridge = { postMessage: message => {
          const request = JSON.parse(message)
          queueMicrotask(() => window.__cupAudio({ rid: request.rid, result: wav }))
        } }
        Object.assign(window._appSettings, { recPlayShuffle: true, recPlayLoop: 'off', recPlayGapSeconds: 30 })
        window.__switchQueue = [
          { id: 'testVideo02', source: 'YouTube', searchText: 'hagla', timeStart: 3, timeEnd: 5, lineIndex: 2 },
          { id: 'recorded-card', manual: true, source: 'Hej', target: 'Hello', sourceAudioUrl: 'file:///source.wav' },
          { id: 'testVideo01', source: 'YouTube', searchText: 'väljarkår', timeStart: 5, timeEnd: 7, lineIndex: 3 },
          { id: 'text-only', manual: true, source: 'Text-only card', target: 'No recording' },
          { id: 'testVideo01', source: 'YouTube', searchText: 'färgsprakande', timeStart: 1, timeEnd: 3, lineIndex: 1 }
        ]
        const leak = document.createElement('button')
        leak.id = 'underlying-page-widget'; leak.textContent = 'Underlying page'
        leak.style.cssText = 'position:fixed;inset:0;z-index:10;background:magenta;'
        window.__underlyingClicks = 0
        leak.onclick = () => window.__underlyingClicks++
        document.body.appendChild(leak)
        window.__playerTask = window.playRecording({ resumeQueue: { queue: window.__switchQueue, pos: 2 }, startPaused: true })
      }, silentWav())
      await playerAt(2)
      await switchTo('Practice')
      await practiceAt(2)
      assert.deepEqual(await order(), expected, 'Player → Practice does not reshuffle or rotate the queue')
      assert.equal(await page.evaluate(() => window._recPlayPaused), true)
      const backdrop = await page.evaluate(() => {
        const style = getComputedStyle(document.body, '::before')
        return { color: style.backgroundColor, position: style.position, content: style.content }
      })
      assert.deepEqual(backdrop, { color: 'rgb(10, 10, 10)', position: 'fixed', content: '""' })
      await page.mouse.click(2, 880)
      assert.equal(await page.evaluate(() => window.__underlyingClicks), 0, 'underlying page cannot receive Practice clicks')
      for (const selector of ['#recPlayingBanner', '#recPlayingSubs', '#recPlayingTransport', '#recPlayingRestorePill']) {
        assert.equal(await page.locator(selector).isVisible(), false, selector + ' cannot show through Practice')
      }
      await page.locator('#practiceMode .practice-play').click()
      await page.waitForFunction(() => window.__yt.state === 1 && !window._practicePlayPending)
      await page.waitForTimeout(1100) // exceeds external-player pause/resume grace
      assert.equal(await page.evaluate(() => window._recPlayPaused), true, 'Practice playback cannot resume the parked Player loop')
      assert.equal(await page.evaluate(() => window._recPlayIndex), 2)

      // Text-only cards must be displayed at n, rather than silently skipped.
      await page.locator('#practiceMode .practice-next').click()
      await practiceAt(3)
      await switchTo('Player')
      await playerAt(3)
      assert.equal(await page.evaluate(() => window._recPlayPaused), true)
      assert((await page.locator('#recPlayingSubs').innerText()).includes('Text-only card'))
      assert.deepEqual(await order(), expected)
      await switchTo('Practice')
      await practiceAt(3)
      // Move to the other occurrence of testVideo01. Preserve its position,
      // not just a matching video id, when returning to Player.
      await page.locator('#practiceMode .practice-next').click()
      await practiceAt(4)
      await switchTo('Player')
      await playerAt(4)
      await page.waitForFunction(() => window.__yt.state === 1 && window.__yt.time === 1)
      assert.deepEqual(await order(), expected)
      await switchTo('Practice')
      await practiceAt(4)
      await page.locator('#practiceMode .practice-play').click()
      await page.waitForFunction(() => window.__yt.state === 1 && !window._practicePlayPending)
      await page.waitForTimeout(1100)
      assert.equal(await page.evaluate(() => window._recPlayPaused), true, 'Practice cannot resume an already-playing Player wait loop')
      for (let i = 0; i < 2; i++) {
        await switchTo('Player')
        await switchTo('Practice')
        await practiceAt(4)
        assert.deepEqual(await order(), expected, 'rapid switches retain the intended item and queue')
      }

      // Both buttons remain within the screen on narrow phones. Top bars
      // may wrap instead of pushing the new mode button beyond the edge.
      for (const width of [320, 360, 390, 430]) {
        await page.setViewportSize({ width, height: 900 })
        const b = await page.getByRole('button', { name: 'Switch to Player', exact: true }).boundingBox()
        assert(b && b.x >= 0 && b.x + b.width <= width + 0.5)
      }
      await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 })
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cupitor-practice-switch-${mobile ? 'mobile' : 'desktop'}.png`) })
      }
      await page.locator('#practiceMode .practice-minimize').click()
      assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::before').content), 'none')
      await page.mouse.click(2, 200)
      assert.equal(await page.evaluate(() => window.__underlyingClicks), 1, 'minimize returns interaction to the main page')
      await page.locator('#practiceMode .practice-restore-btn').click()
      await page.locator('#practiceMode .practice-close').click()
      await page.evaluate(() => window.stopPlayingRecording())
      await page.evaluate(() => window.__playerTask)
      // Practice opened by itself can also start Player at its current card.
      await page.evaluate(() => {
        document.getElementById('underlying-page-widget').remove()
        window.openPracticeMode({ resumeQueue: { queue: window.__switchQueue, pos: 1 } })
      })
      await practiceAt(1)
      await switchTo('Player')
      await playerAt(1)
      await page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused)
      await switchTo('Practice')
      await practiceAt(1)
      assert.equal(await page.evaluate(() => window._recPlayManualAudio.paused), true)
      await page.setViewportSize({ width: 320, height: 900 })
      const reachable = await page.getByRole('button', { name: 'Switch to Player', exact: true }).evaluate(el => {
        const r = el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      })
      assert(reachable, 'Player switch remains reachable beside a recorded card at 320px')
      await page.locator('#practiceMode .practice-close').click()
      await page.evaluate(() => window.stopPlayingRecording())
      await page.waitForFunction(() => !window._recPlayQueue)
      // A delayed Player load cannot autoplay after Practice takes ownership
      // of the shared iframe, even if the player becomes ready afterwards.
      await page.evaluate(() => {
        window.__yt.id = 'cold-player'; window.__yt.events = []; window.ytPlayerReady = false
        window.__coldPlayerTask = window.playRecording({ resumeQueue: { queue: window.__switchQueue, pos: 0 } })
      })
      await playerAt(0)
      await switchTo('Practice')
      await practiceAt(0)
      await page.evaluate(() => { window.__yt.events = []; window.ytPlayerReady = true })
      await page.waitForFunction(() => window.__yt.events.some(e => e.action === 'cue' && e.id === 'testVideo02'))
      await page.waitForTimeout(250)
      assert.equal(await page.evaluate(() => window.__yt.events.some(e => ['load', 'play', 'seek'].includes(e.action))), false)
      await page.locator('#practiceMode .practice-close').click()
      await page.evaluate(() => window.stopPlayingRecording())
      await page.evaluate(() => window.__coldPlayerTask)
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: opaque Practice, same-item two-way switching, duplicate video ids, recorded/text-only cards and queue order passed`)
    } finally { await page.close() }
  }
}
module.exports = { checkViewSwitching }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkViewSwitching(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
