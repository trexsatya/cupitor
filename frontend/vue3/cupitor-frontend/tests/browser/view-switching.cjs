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
    const switchTo = async name => {
      const button = page.getByRole('button', { name: 'Switch to ' + name, exact: true })
      if (name === 'Practice' && !await button.isVisible()) await page.getByRole('button', { name: 'Show details', exact: true }).click()
      return mobile ? button.tap() : button.click()
    }
    const practiceAt = index => page.waitForFunction(index => window._practiceActive && window._practiceIdx === index &&
      !document.querySelector('#practiceMode .practice-loading'), index)
    const playerAt = index => page.waitForFunction(index => !window._practiceActive && window._playingRecording &&
      window._recPlayIndex === index && window._recPlayCurrentItem === window._recPlayQueue[index] && window._recNavGotoIndex == null, index)
    const order = () => page.evaluate(() => (window._practiceActive ? window._practiceCards : window._recPlayQueue)
      .map(item => item.id + ':' + (item.timeStart || 0)))
    const playOnMain = () => page.evaluate(async () => {
      window.mediaSelected = { link: 'testVideo01', source: 'link' }
      await window.playSelectedMedia()
    })
    const expected = ['testVideo02:3', 'recorded-card:0', 'testVideo01:5', 'text-only:0', 'testVideo01:1']
    const checkBackdrop = async () => {
      const state = await page.evaluate(() => {
        const style = getComputedStyle(document.body, '::before')
        return { color: style.backgroundColor, position: style.position, content: style.content,
          underlyingHit: document.elementFromPoint(2, 52)?.id === 'underlying-page-widget' }
      })
      assert.deepEqual(state, { color: 'rgb(10, 10, 10)', position: 'fixed', content: '""', underlyingHit: false })
      assert.equal(await page.locator('#search-pagination').isVisible(), false, 'search pagination is hidden in either study view')
      assert.equal(await page.locator('#mediaControls').isVisible(), false, 'main-page speed panel is hidden in either study view')
    }
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
          { id: 'testVideo01', source: 'YouTube', word: 'väljarkår', searchText: 'väljarkår', timeStart: 5, timeEnd: 7, lineIndex: 3 },
          { id: 'text-only', manual: true, source: 'Text-only card', target: 'No recording' },
          { id: 'testVideo01', source: 'YouTube', searchText: 'färgsprakande', timeStart: 1, timeEnd: 3, lineIndex: 1 }
        ]
        const leak = document.createElement('button')
        leak.id = 'underlying-page-widget'; leak.textContent = 'Underlying page'
        leak.style.cssText = 'position:fixed;inset:0;z-index:10;background:magenta;'
        window.__underlyingClicks = 0
        leak.onclick = () => window.__underlyingClicks++
        document.body.appendChild(leak)
        document.getElementById('resultContainer').style.display = 'block'
        document.getElementById('mediaRelatedContainer').style.display = 'block'
        document.getElementById('search-pagination').style.display = 'block'
        window.__paginationWasVisible = !!document.getElementById('search-pagination').getClientRects().length
        window.__playerTask = window.playRecording({ resumeQueue: { queue: window.__switchQueue, pos: 2 }, startPaused: true })
      }, silentWav())
      await playerAt(2)
      assert.equal(await page.evaluate(() => window.__paginationWasVisible), true, 'fixture starts with visible search pagination')
      await page.getByRole('button', { name: 'Replay current item', exact: true }).waitFor({ state: 'visible' })
      assert.equal(await page.getByRole('button', { name: 'Switch to Practice', exact: true }).isVisible(), false)
      await page.locator('#recPlayingPauseBtn').click()
      await page.locator('#recPlayingSubs .rec-ps-row').first().waitFor({ state: 'visible' })
      await page.locator('#recPlayingPauseBtn').click()
      await checkBackdrop()
      await page.waitForFunction(() => document.body.classList.contains('study-controls-hidden'))
      await page.locator('#studyMediaDivider').waitFor({ state: 'hidden' })
      await checkBackdrop()
      assert.equal(await page.locator('#recPlayingWord').isVisible(), true, 'foreground word stays above the backdrop')
      assert.equal(await page.locator('#recPlayingSubs .rec-ps-row').first().isVisible(), true, 'foreground subtitles stay above the backdrop')
      if (process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cupitor-player-backdrop-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' })
      }
      if (mobile) await page.touchscreen.tap(2, 52)
      else await page.mouse.click(2, 52)
      await page.locator('#recPlayingMinimizeBtn').waitFor({ state: 'visible' })
      // Keyboard M must use the same pause/park and restore paths as the UI.
      await page.evaluate(() => document.activeElement?.blur())
      await page.keyboard.press('m')
      await page.waitForFunction(() => window._recPlayMinimized && !document.body.classList.contains('rec-playing'))
      await page.keyboard.press('m')
      await page.waitForFunction(() => !window._recPlayMinimized && document.body.classList.contains('rec-playing'))
      assert.equal(await page.evaluate(() => window._recPlayIndex), 2, 'M preserves the Player card')
      assert.equal(await page.evaluate(() => window.__underlyingClicks), 0, 'underlying page cannot receive Player taps')
      await page.locator('#recPlayingMinimizeBtn').click()
      assert.equal(await page.locator('#mediaControls').isVisible(), false, 'Player minimize cannot uncover its old main-page speed panel')
      assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::before').content), 'none')
      assert.equal(await page.locator('#search-pagination').isVisible(), true, 'minimizing restores search pagination')
      if (process.env.SCREENSHOT_DIR) {
        // The click-catching fixture covers the page in magenta. Hide only
        // that fixture while capturing the real minimized page and pill.
        await page.locator('#underlying-page-widget').evaluate(el => { el.style.visibility = 'hidden' })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cupitor-player-minimized-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' })
        await page.locator('#underlying-page-widget').evaluate(el => { el.style.visibility = '' })
      }
      await page.mouse.click(2, 52)
      assert.equal(await page.evaluate(() => window.__underlyingClicks), 1, 'Player minimize returns interaction to the main page')
      await page.locator('.rec-pill-restore').click()
      await checkBackdrop()
      await page.evaluate(() => { window.__underlyingClicks = 0 })
      await switchTo('Practice')
      await practiceAt(2)
      // The keyboard uses the existing flip, details and view-switch controls.
      await page.evaluate(() => document.activeElement?.blur())
      await page.keyboard.press('f')
      assert.equal(await page.evaluate(() => window._practiceFlipped), true, 'F flips the card')
      await page.keyboard.press('r')
      assert.equal(await page.evaluate(() => window._practiceFlipped), false, 'R flips it back')
      await page.keyboard.press('i')
      assert.equal(await page.locator('#practiceMode .practice-info-panel').isVisible(), true, 'I shows card details')
      await page.keyboard.press('i')
      assert.equal(await page.locator('#practiceMode .practice-info-panel').isVisible(), false, 'I hides card details')
      await page.keyboard.press('e')
      assert.equal(await page.locator('#manualEntryEditor:visible').count(), 0,
        'E ignores captured video clips rather than opening the manual-card editor')
      // A mouse double-click and swipe cannot flip/navigate the desktop card.
      await page.locator('#practiceMode .practice-front-face').dblclick({ force: true })
      assert.equal(await page.evaluate(() => window._practiceFlipped), false,
        'double-click should select text instead of flipping')
      const cardRect = await page.locator('#practiceMode .practice-card').boundingBox()
      if (cardRect) {
        const x = cardRect.x + cardRect.width / 2
        const y = cardRect.y + Math.min(cardRect.height / 2, 70)
        await page.mouse.move(x + 100, y)
        await page.mouse.down()
        await page.mouse.move(x - 100, y, { steps: 5 })
        await page.mouse.up()
        assert.equal(await page.evaluate(() => window._practiceIdx), 2,
          'mouse dragging across the card must not swipe to another item')
      }
      await page.keyboard.press('p')
      await playerAt(2)
      await page.keyboard.press('p')
      await practiceAt(2)
      assert.deepEqual(await order(), expected, 'P keeps playlist order and the current item')
      assert.equal(await page.getByRole('button', { name: 'Replay current item', exact: true }).isVisible(), false,
        'Player Replay is hidden in Practice; its source-reveal arrow is a different control')
      assert.deepEqual(await order(), expected, 'Player → Practice does not reshuffle or rotate the queue')
      assert.equal(await page.evaluate(() => window._recPlayPaused), true)
      await checkBackdrop()
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
      await page.evaluate(() => document.activeElement?.blur())
      await page.keyboard.press('m')
      await page.waitForFunction(() => window._practiceMinimized && !document.body.classList.contains('practice-mode'))
      await page.keyboard.press('m')
      await page.waitForFunction(() => !window._practiceMinimized && document.body.classList.contains('practice-mode'))
      assert.equal(await page.evaluate(() => window._practiceIdx), 4, 'M preserves the Practice card')
      await page.locator('#practiceMode .practice-minimize').click()
      assert.equal(await page.locator('#mediaControls').isVisible(), false, 'Practice minimize cannot uncover the main-page speed panel')
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
      // E must use the exact edit action of the current editable manual card.
      // Fixture deck entries need their playlist backlink for that action.
      await page.evaluate(() => {
        const it = window._practiceCards[window._practiceIdx]
        const name = '__keyboard_edit_fixture__'
        it._recName = name
        it._st = 'sample'
        it._w = 'sample'
        it._idx = 0
        window._recordings[name] = { items: { sample: { sample: [{ ...it }] } } }
      })
      await page.evaluate(() => document.activeElement?.blur())
      await page.keyboard.press('e')
      await page.locator('#manualEntryEditor:visible').waitFor({ state: 'visible' })
      assert.equal(await page.evaluate(() => window._practiceIdx), 1,
        'E opens editing without changing the current Practice item')
      // Editor must be modal; unrelated keys must not navigate or flip behind it.
      await page.keyboard.press('f')
      assert.equal(await page.evaluate(() => window._practiceFlipped), false)
      await page.evaluate(() => $('#manualEntryEditor').dialog('close'))
      await page.waitForFunction(() => !$('#manualEntryEditor').is(':visible'))
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
      // Ordinary search-result playback still opens the main-page panel,
      // including after closing either study view.
      await playOnMain()
      assert.equal(await page.locator('#mediaControls').isVisible(), true, 'main-page playback opens its speed controls')
      await page.evaluate(() => window.openPracticeMode({ resumeQueue: { queue: window.__switchQueue, pos: 4 } }))
      await practiceAt(4)
      assert.equal(await page.locator('#mediaControls').isVisible(), false)
      await page.locator('#practiceMode .practice-minimize').click()
      assert.equal(await page.locator('#mediaControls').isVisible(), false, 'Practice clears a previously open main-page panel')
      await playOnMain()
      assert.equal(await page.locator('#mediaControls').isVisible(), true, 'explicit main-page playback works with Practice parked')
      await page.locator('#practiceMode .practice-restore-btn').click()
      await page.locator('#practiceMode .practice-minimize').click()
      assert.equal(await page.locator('#mediaControls').isVisible(), false, 'restoring/minimizing Practice clears main-page controls again')
      await page.locator('#practiceMode .practice-restore-btn').click()
      await page.locator('#practiceMode .practice-close').click()
      await playOnMain()
      assert.equal(await page.locator('#mediaControls').isVisible(), true, 'closing Practice does not disable main-page controls')
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: opaque Player/Practice, same-item two-way switching, duplicate video ids, recorded/text-only cards and queue order passed`)
    } finally { await page.close() }
  }
}
module.exports = { checkViewSwitching }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkViewSwitching(browser) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
