// Regression: study overlays must never collapse the underlying main page.
// In particular mobile uses window scrolling and desktop keeps an independent
// #result scrollTop, both of which were lost when the panels used display:none.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1280, height: 850 },
    isMobile: mobile, hasTouch: mobile,
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const snapshot = () => page.evaluate(() => {
    const result = document.getElementById('result')
    const vocabulary = document.getElementById('vocabularyResult')
    return {
      y: window.scrollY,
      resultTop: result.scrollTop,
      docHeight: document.scrollingElement.scrollHeight,
      resultHeight: result.getBoundingClientRect().height,
      vocabHeight: vocabulary.getBoundingClientRect().height,
    }
  })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async wav => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window.AudioBridge = { postMessage(raw) {
        const message = JSON.parse(raw)
        queueMicrotask(() => window.__cupAudio?.({
          rid: message.rid, result: message.op === 'load' ? wav : null,
        }))
      } }
      Object.assign(window._appSettings, { recPlayShuffle: false, recPlayLoop: 'off' })

      // Use long panels within the real main-page DOM, not an unrelated
      // footer. Removing either panel should collapse the scroll range.
      const vocabulary = document.getElementById('vocabularyResult')
      vocabulary.style.display = 'block'
      vocabulary.insertAdjacentHTML('beforeend',
        '<div id="scroll-vocab-fixture" style="height:1800px"></div>')
      const result = document.getElementById('result')
      result.style.display = 'block'
      result.insertAdjacentHTML('beforeend',
        '<div id="scroll-result-fixture" style="height:3400px"></div>')
      window.scrollTo({ top: 950, behavior: 'instant' })
      result.scrollTop = 430
    }, silentWav())

    const before = await snapshot()
    assert(before.y > 300, 'fixture must start midway down the main document: ' + JSON.stringify(before))
    if (!mobile) assert(before.resultTop > 100,
      'desktop must start with the results list scrolled: ' + JSON.stringify(before))

    const assertPreserved = async label => {
      await page.evaluate(() => new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const after = await snapshot()
      assert(Math.abs(after.y - before.y) <= 2,
        label + ' changed main page scrollY: ' + JSON.stringify({ before, after }))
      assert(Math.abs(after.docHeight - before.docHeight) <= 2,
        label + ' changed main document height: ' + JSON.stringify({ before, after }))
      assert(Math.abs(after.resultHeight - before.resultHeight) <= 2,
        label + ' collapsed results: ' + JSON.stringify({ before, after }))
      assert(Math.abs(after.vocabHeight - before.vocabHeight) <= 2,
        label + ' collapsed vocabulary: ' + JSON.stringify({ before, after }))
      if (!mobile) assert.equal(after.resultTop, before.resultTop,
        label + ' reset the desktop results scrollTop')
    }

    await page.evaluate(() => window.openPracticeMode({
      queue: [{ id: 'scroll-practice', manual: true, source: 'Practice card' }],
      temporary: true,
    }))
    await page.waitForFunction(() => document.body.classList.contains('practice-mode'))
    await assertPreserved('opening Practice')

    await page.evaluate(() => document.querySelector('#practiceMode .practice-minimize').click())
    await page.waitForFunction(() => !document.body.classList.contains('practice-mode'))
    await assertPreserved('minimizing Practice')

    await page.evaluate(() => document.querySelector('.practice-restore-btn').click())
    await page.waitForFunction(() => document.body.classList.contains('practice-mode'))
    await assertPreserved('restoring Practice')

    await page.evaluate(() => window.closePracticeMode())
    await page.waitForFunction(() => !document.body.classList.contains('practice-mode'))
    await assertPreserved('closing Practice')

    await page.evaluate(() => {
      window.__playerScrollTask = window.playRecording({
        queue: [{ id: 'scroll-player', manual: true, source: 'Player card',
          sourceAudioUrl: 'file:///scroll-player.wav' }],
        temporary: true, shuffle: false,
      })
    })
    await page.waitForFunction(() => document.body.classList.contains('rec-playing'))
    await assertPreserved('opening Player')

    await page.evaluate(() => document.getElementById('recPlayingMinimizeBtn').click())
    await page.waitForFunction(() => !document.body.classList.contains('rec-playing'))
    await assertPreserved('minimizing Player')

    await page.evaluate(() => document.getElementById('recPlayingRestorePill').click())
    await page.waitForFunction(() => document.body.classList.contains('rec-playing'))
    await assertPreserved('restoring Player')

    await page.evaluate(() => window.stopPlayingRecording())
    await page.waitForFunction(() => !document.body.classList.contains('rec-playing'))
    await assertPreserved('closing Player')
    assert.deepEqual(errors, [], 'no page errors during study transitions')
    console.log((mobile ? 'Mobile' : 'Desktop') + ': main page and results scroll survive Player/Practice open, minimize, restore and close')
  } finally {
    await page.close()
  }
}

;(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
  })
  try { for (const mobile of [false, true]) await check(browser, mobile) }
  finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
