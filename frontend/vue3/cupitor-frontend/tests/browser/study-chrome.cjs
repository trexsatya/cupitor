const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function checkStudyChrome(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
    page.setDefaultTimeout(10000)
    await page.route('**/*', route => new URL(route.request().url()).hostname === 'video.example.test'
      ? route.fulfill({ contentType: 'text/html', body: '<body data-clicks="0" style="margin:0"><button style="position:absolute;inset:0;width:100%;height:100%" onclick="document.body.dataset.clicks=Number(document.body.dataset.clicks)+1">Embedded player</button></body>' })
      : serveFixtures(route))
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
    const hide = async () => {
      await page.clock.fastForward(3500)
      await page.waitForFunction(() => document.body.classList.contains('study-controls-hidden'))
      await page.locator('#studyMediaDivider').waitFor({ state: 'hidden' })
    }
    const wakeCard = async () => {
      const box = await page.locator('#practiceMode .practice-card, body.rec-playing #recPlayingSubs').boundingBox()
      await tap(box.x + box.width / 2, box.y + Math.min(90, box.height / 2))
      await page.waitForFunction(() => !document.body.classList.contains('study-controls-hidden'))
    }
    const screenshot = async name => {
      if (!mobile || !process.env.SCREENSHOT_DIR) return
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await page.clock.runFor(250) // Capture the completed fade, not its first frame.
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, name + '.png') })
    }
    const swipe = async (horizontal) => {
      const r = await page.locator('#practiceMode .practice-card').boundingBox()
      const start = { x: r.x + r.width * (horizontal ? 0.8 : 0.5), y: r.y + r.height * 0.7 }
      const end = { x: r.x + r.width * (horizontal ? 0.2 : 0.5), y: horizontal ? start.y : start.y - 160 }
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
        { x: start.x + (end.x - start.x) * i / 8, y: start.y + (end.y - start.y) * i / 8 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
    }
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      await page.evaluate(wav => {
        const s = window.__yt = { id: 'testVideo01', time: 1, state: 2, plays: 0 }
        window.ytPlayer = {
          pauseVideo: () => { s.state = 2 }, playVideo: () => { s.state = 1; s.plays++ },
          loadVideoById: v => { s.id = typeof v === 'string' ? v : v.videoId; s.time = v.startSeconds || 0; s.state = 1; s.plays++ },
          cueVideoById: v => { s.id = v.videoId; s.time = v.startSeconds || 0; s.state = 5 },
          seekTo: t => { s.time = t }, getCurrentTime: () => s.time, getPlayerState: () => s.state,
          getVideoData: () => ({ video_id: s.id }), getDuration: () => 1000,
          getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id, getIframe: () => document.getElementById('youtubePlayer'),
          setPlaybackRate: () => {}, getPlaybackRate: () => 1, getAvailablePlaybackRates: () => [0.5, 0.75, 1], addEventListener: () => {}
        }
        window.ytPlayerReady = true
        window.AudioBridge = { postMessage: message => {
          const { op, rid } = JSON.parse(message)
          const result = op === 'ensureMicPerm' ? 'granted' : op === 'recordStart' ? 'file:///take.wav' : op === 'load' ? wav : null
          queueMicrotask(() => window.__cupAudio({ rid, result }))
        } }
        Object.assign(window._appSettings, { recPlayShuffle: false, recPlayLoop: 'off' })
        window.__chromeCards = [
          { id: 'testVideo01', source: 'YouTube', word: 'färgsprakande', timeStart: 1, timeEnd: 3, lineIndex: 1 },
          { id: 'testVideo02', source: 'YouTube', word: 'hagla', timeStart: 3, timeEnd: 5, lineIndex: 2 }
        ]
        const frame = document.createElement('iframe'); frame.id = 'testStudyFrame'; frame.src = 'https://video.example.test/player'
        document.getElementById('youtubePlayer').appendChild(frame)
        window.openPracticeMode({ queue: window.__chromeCards, single: true })
      }, silentWav())
      await page.waitForFunction(() => !document.querySelector('#practiceMode .practice-loading') && window.__yt.state === 5)
      await page.frameLocator('#testStudyFrame').getByRole('button', { name: 'Embedded player' }).waitFor()
      await page.locator('#srtLoadingBanner').waitFor({ state: 'hidden' })
      await page.clock.install()
      const before = await page.locator('#practiceMode .practice-card').boundingBox()
      await screenshot('cupitor-practice-controls-shown')
      await hide()
      assert.equal(await page.locator('#practiceMode .practice-topbar').isVisible(), false)
      assert.equal(await page.locator('#practiceMode .practice-rec-bar').isVisible(), false)
      assert.equal(await page.locator('#practiceMode .practice-front').isVisible(), true)
      assert.deepEqual(await page.locator('#practiceMode .practice-card').boundingBox(), before, 'hiding controls never moves the text')
      await screenshot('cupitor-practice-controls-hidden')
      await wakeCard()
      assert.equal(await page.evaluate(() => window._practiceFlipped), false, 'first tap only reveals controls')
      assert.equal(await page.evaluate(() => window.__yt.plays), 0)
      await page.locator('#practiceMode .practice-play').click()
      await page.waitForFunction(() => !window._practicePlayPending && window.__yt.state === 1)
      await hide()
      const video = await page.locator('#mediaContainer').boundingBox()
      await tap(video.x + video.width / 2, video.y + video.height / 2)
      await page.locator('#practiceMode .practice-nav').waitFor({ state: 'visible' })
      assert.equal(await page.frameLocator('#testStudyFrame').locator('body').getAttribute('data-clicks'), '0', 'wake tap cannot click through into the iframe')
      assert.equal(await page.evaluate(() => window.__yt.plays), 1)
      await tap(video.x + video.width / 2, video.y + video.height / 2)
      await page.waitForFunction(() => document.activeElement?.tagName === 'IFRAME')
      assert.equal(await page.frameLocator('#testStudyFrame').locator('body').getAttribute('data-clicks'), '1', 'the player is usable after controls return')
      await hide()
      if (mobile) await swipe(true)
      else {
        const card = await page.locator('#practiceMode .practice-card').boundingBox()
        await page.mouse.move(card.x + card.width * 0.8, card.y + 120); await page.mouse.down()
        await page.mouse.move(card.x + card.width * 0.2, card.y + 120, { steps: 8 }); await page.mouse.up()
      }
      await page.waitForFunction(() => window._practiceIdx === 1 && !document.querySelector('#practiceMode .practice-loading'))
      assert.equal(await page.locator('#practiceMode .practice-nav').isVisible(), false, 'swipes still navigate without revealing chrome')
      await page.locator('#practiceMode .practice-front').evaluate(el => { el.innerHTML += '<p>Scroll this study text.</p>'.repeat(35) })
      if (mobile) await swipe(false)
      else {
        const r = await page.locator('#practiceMode .practice-card').boundingBox()
        await page.mouse.move(r.x + r.width / 2, r.y + 150); await page.mouse.wheel(0, 220)
      }
      await page.waitForFunction(() => document.querySelector('#practiceMode .practice-front-face').scrollTop > 0)
      assert.equal(await page.evaluate(() => window._practiceIdx), 1)
      await wakeCard()
      await page.locator('#practiceMode .practice-settings').click()
      await page.clock.fastForward(5000)
      assert.equal(await page.locator('#practiceMode .practice-topbar').isVisible(), true, 'settings stay visible while open')
      await page.locator('#practiceMode .practice-speeds-input').fill('1, 0.75, 0.5')
      await page.clock.fastForward(5000)
      assert.equal(await page.locator('#practiceMode .practice-settings-panel').isVisible(), true)
      await page.locator('#practiceMode .practice-settings').click()
      await page.locator('#practiceMode .prec-toggle').click()
      await page.locator('#practiceMode .prec-toggle.on').waitFor()
      await page.clock.fastForward(5000)
      assert.equal(await page.locator('#practiceMode .prec-toggle').isVisible(), true, 'recording Stop remains available')
      await page.locator('#practiceMode .prec-toggle').click()
      await page.waitForFunction(() => !document.querySelector('#practiceMode .prec-toggle.on'))
      await hide()
      await page.evaluate(() => document.activeElement.blur())
      await page.keyboard.press('s')
      await page.locator('#practiceMode .practice-nav').waitFor({ state: 'visible' })
      await page.locator('#practiceMode .practice-minimize').click()
      assert.equal(await page.locator('#practiceMode .practice-restore').isVisible(), true)
      assert.equal(await page.locator('#studyControlsWakeSurface').isVisible(), false)
      await page.locator('#practiceMode .practice-restore-btn').click()
      await page.locator('#practiceMode .practice-close').click()

      await page.evaluate(() => { window.__playerTask = window.playRecording({ resumeQueue: { queue: window.__chromeCards, pos: 0 } }) })
      await page.waitForFunction(() => window.__yt.state === 1 && !!document.querySelector('#recPlayingSubs'))
      await page.locator('#recPlayingPauseBtn').click()
      const textBefore = await page.locator('#recPlayingSubs').boundingBox()
      await hide()
      assert.equal(await page.locator('#recPlayingTransport').isVisible(), false)
      assert.equal(await page.locator('#recPlayingBanner').isVisible(), false)
      assert.equal(await page.locator('#recPlayingSubs').isVisible(), true)
      assert.deepEqual(await page.locator('#recPlayingSubs').boundingBox(), textBefore)
      await screenshot('cupitor-player-controls-hidden')
      await wakeCard()
      assert.equal(await page.evaluate(() => window._recPlayPaused), true, 'revealing chrome cannot resume playback')
      await screenshot('cupitor-player-controls-shown')
      await page.getByRole('button', { name: 'Show details', exact: true }).click()
      await page.clock.fastForward(5000)
      assert.equal(await page.locator('#recPlayingBanner').isVisible(), true)
      await page.getByRole('button', { name: 'Show details', exact: true }).click()
      await hide()
      await page.keyboard.press('Tab')
      await page.locator('#recPlayingTransport').waitFor({ state: 'visible' })
      await page.locator('#recPlayingCloseBtn').click()
      await page.evaluate(() => window.__playerTask)
      await page.evaluate(() => { window.__playerTask = window.playRecording({ queue: [
        { id: 'manual', manual: true, source: 'Hej', target: 'Hello', sourceAudioUrl: 'file:///source.wav' }] }) })
      await page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused)
      await page.locator('#recPlayingPauseBtn').click()
      await hide()
      const audio = await page.locator('#recPlayingAudio').boundingBox()
      assert.equal(await page.locator('#recPlayingAudio audio').isVisible(), false)
      await tap(audio.x + audio.width / 2, audio.y + 60)
      await page.locator('#recPlayingAudio audio').waitFor({ state: 'visible' })
      assert.equal(await page.evaluate(() => window._recPlayManualAudio.paused), true, 'first tap cannot activate native audio controls')
      await page.locator('#recPlayingCloseBtn').click()
      await page.evaluate(() => window.__playerTask)
      assert.equal(await page.locator('#studyControlsWakeSurface').isVisible(), false)
      assert.equal(await page.evaluate(() => document.body.classList.contains('study-controls-hidden')), false)
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: idle hiding, safe tap wake, iframe/audio controls, swipes, scroll, keyboard, recording and cleanup passed`)
    } finally { await page.close() }
  }
}
module.exports = { checkStudyChrome }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkStudyChrome(browser) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
