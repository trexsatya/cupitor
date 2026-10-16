// Uses fixture playlists only. Run with the same Chromium setup as
// language-dialogs.cjs; no account, repository or native app data is changed.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const itemCount = process.argv.includes('--huge') ? 10000 : 600

async function checkScroll(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push('Unexpected dialog: ' + d.message()); d.dismiss() })
  if (itemCount > 600) page.on('console', m => { if (m.text().startsWith('[recorded-scroll]')) console.log(m.text()) })
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    const native = await page.evaluate(async itemCount => {
      const frames = (n = 3) => new Promise(resolve => {
        const next = () => --n <= 0 ? resolve() : requestAnimationFrame(next)
        requestAnimationFrame(next)
      })
      const items = { word: { word: Array.from({ length: itemCount }, (_, i) =>
        ({ manual: true, source: 'Card ' + i, target: 'Definition ' + i, id: 'mc-' + i })) } }
      window._recordings = { 'Scroll test': { items } }
      window._recording = { state: 'idle', currentName: 'Scroll test', items }
      console.info('[recorded-scroll] opening ' + itemCount + ' rows')
      window.openRecordingReviewDialog()
      console.info('[recorded-scroll] rendered ' + itemCount + ' rows')
      await frames()
      const el = document.getElementById('recordingReviewDialog')
      const deepNative = []
      const max = el.scrollHeight - el.clientHeight
      for (const top of [Math.floor(max / 2), max - 100]) {
        el.scrollTop = top
        window.openRecordingReviewDialog()
        await frames()
        deepNative.push({ wanted: top, actual: el.scrollTop })
      }
      el.scrollTop = 1200
      window.openRecordingReviewDialog()
      await frames()
      const refreshed = el.scrollTop
      // A preview/height recheck must stay near the current position and
      // cannot restore an old snapshot over a newer user scroll.
      el._fsNativeOk = false
      window._installWebViewScroll(el)
      const duringProbe = el.scrollTop
      el.scrollTop = 1600
      await frames()
      const afterProbe = el.scrollTop
      el._fsNativeOk = false
      window._installWebViewScroll(el)
      el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -1600 }))
      el.scrollTop = 0
      await frames()
      const reachedTop = { position: el.scrollTop, fallback: !!el._fsInner }
      await frames(18) // allow the interrupted check to retry while idle
      el.scrollTop = 1600
      const touch = (type, y, at, x = 180, count = 1) => {
        const target = el._fsInner || el
        const point = new Touch({ identifier: 1, target, clientX: x, clientY: y })
        const touches = ['touchend', 'touchcancel'].includes(type) ? []
          : Array.from({ length: count }, (_, i) => i ? new Touch({ identifier: 2, target, clientX: x + 20, clientY: y }) : point)
        const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches, changedTouches: [point] })
        Object.defineProperty(event, 'timeStamp', { value: at })
        target.dispatchEvent(event)
      }
      window._scrollTest = { el, frames, touch }
      return { height: el.scrollHeight, rows: el.querySelectorAll('.rec-item').length, deepNative, fallback: !!el._fsInner, refreshed, duringProbe, afterProbe, reachedTop }
    }, itemCount)
    assert.equal(native.rows, itemCount)
    assert(native.deepNative.every(p => p.actual === p.wanted), 'deep native positions survive refresh')
    assert(native.height > 16384, 'exercise a list beyond the old WebView height limit')
    assert.equal(native.fallback, false, 'working browsers retain native scrolling')
    assert.equal(native.refreshed, 1200)
    assert(Math.abs(native.duringProbe - 1200) <= 2, 'a probe must not jump to the top')
    assert.equal(native.afterProbe, 1600, 'a newer scroll wins over the probe snapshot')
    assert.deepEqual(native.reachedTop, { position: 0, fallback: false }, 'scrolling to the top during a probe must not activate fallback')

    if (!mobile) {
      const box = await page.locator('#recordingReviewDialog').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.wheel(0, 240)
      await page.waitForFunction(() => document.getElementById('recordingReviewDialog').scrollTop > 1700)
      await page.evaluate(async () => { const { el, frames } = window._scrollTest; el.scrollTop = 0; await frames() })
      const first = await page.locator('#recordingReviewDialog .rec-item:nth-child(1) .rec-drag').boundingBox()
      const third = await page.locator('#recordingReviewDialog .rec-item:nth-child(3) .rec-drag').boundingBox()
      await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
      await page.mouse.down()
      await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 10 })
      await page.mouse.up()
      await page.waitForFunction(() => window._recording.items.word.word[0].id !== 'mc-0', undefined, { timeout: 10000 })
      assert.equal(await page.locator('#recordingReviewDialog .rec-item-no').first().innerText(), '1')
    } else {
      // Engage the page-level rescue through its real two-miss detector.
      // Synthetic drags have no native default scroll, so they model a stuck
      // WebView without replacing or bypassing the installed event handlers.
      for (let i = 0; i < 2; i++) {
        await page.evaluate(i => {
          const { touch } = window._scrollTest, at = 1000 + i * 300
          touch('touchstart', 500, at); touch('touchmove', 400, at + 20); touch('touchend', 400, at + 30)
        }, i)
        await page.waitForFunction(i => i ? window.__scrollRescue.engaged : window.__scrollRescue.misses === 1, i)
      }
      const rescued = await page.evaluate(async () => {
        const { el, touch, frames } = window._scrollTest
        touch('touchstart', 500, 2000); touch('touchmove', 460, 2020)
        touch('touchmove', 420, 2040); touch('touchmove', 422, 2050); touch('touchend', 422, 2060)
        const released = el.scrollTop
        await frames(12)
        const glided = el.scrollTop
        touch('touchstart', 422, 2300); touch('touchcancel', 422, 2301)
        return { released, glided }
      })
      assert(rescued.glided >= rescued.released, 'scroll rescue cannot reverse a downward swipe on release')

      const fallback = await page.evaluate(async () => {
        const { el, frames, touch } = window._scrollTest
        // Model the old WebView's broken vertical scrollTop path. The app's
        // actual native-scroll probe must detect it and install its fallback.
        Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => 0, set: () => {} })
        el._fsNativeOk = false
        window._installWebViewScroll(el)
        await frames()
        const fallback = !!el._fsInner
        const max = el._fsInner.offsetHeight - el.clientHeight
        const deepFallback = []
        for (const top of [Math.floor(max / 2), max - 100, max + 1000]) {
          el._fsApply(top)
          await frames()
          deepFallback.push({ wanted: Math.min(top, max), actual: el._fsOff })
        }
        const swipe = (at, type = 'touchend') => {
          touch('touchstart', 500, at); touch('touchmove', 460, at + 20)
          touch('touchmove', 420, at + 40); touch('touchmove', 422, at + 50)
          touch(type, 422, at + 60)
          return el._fsOff
        }
        el._fsApply(1200)
        const released = swipe(3000), trajectory = []
        for (let i = 0; i < 20; i++) { await frames(1); trajectory.push(el._fsOff) }
        touch('touchstart', 422, 3400); touch('touchcancel', 422, 3401)
        el._fsApply(1200)
        const cancelled = swipe(4000, 'touchcancel')
        await frames(10)
        const afterCancel = el._fsOff
        touch('touchstart', 500, 5000); touch('touchmove', 420, 5020); touch('touchend', 420, 5200)
        const held = el._fsOff
        await frames(10)
        const afterHold = el._fsOff
        swipe(6000)
        window.openRecordingReviewDialog()
        const refreshed = el._fsOff
        await frames(10)
        const afterRefresh = el._fsOff
        // Switching playlists during momentum must not move the new list.
        swipe(7000)
        window._recordings.Other = { items: window._recording.items }
        window._recording.currentName = 'Other'
        window.openRecordingReviewDialog()
        await frames(10)
        const switched = el._fsOff
        // Sideways gestures and scrolling still belong to the browser.
        el._fsInner.style.minWidth = '1200px'
        el._fsApply(500)
        touch('touchstart', 400, 8000, 100); touch('touchmove', 402, 8020, 200); touch('touchend', 402, 8030, 200)
        await frames(5)
        const sideways = el._fsOff
        el.scrollLeft = 100
        return { fallback, deepFallback, released, trajectory, cancelled, afterCancel, held, afterHold,
          refreshed, afterRefresh, switched, sideways, scrollLeft: el.scrollLeft }
      })
      assert(fallback.fallback)
      assert(fallback.deepFallback.every(p => p.actual === p.wanted), 'deep fallback positions and bounds remain stable')
      assert(fallback.trajectory.every((top, i) => top >= (i ? fallback.trajectory[i - 1] : fallback.released)),
        'a final two-pixel finger reversal cannot make the downward glide scroll upward')
      assert.equal(fallback.afterCancel, fallback.cancelled, 'cancelled touch has no inertia')
      assert.equal(fallback.afterHold, fallback.held, 'holding still clears stale velocity')
      assert.equal(fallback.afterRefresh, fallback.refreshed, 'refresh cancels the replaced list animation')
      assert.equal(fallback.switched, 0, 'a new playlist starts still, at its beginning')
      assert.equal(fallback.sideways, 500)
      assert.equal(fallback.scrollLeft, 100)
      if (process.env.SCREENSHOT_DIR) {
        await page.evaluate(() => {
          const { el } = window._scrollTest
          el._fsInner.style.minWidth = ''
          el._fsMax = null
          el.scrollLeft = 0
          el._fsApply(Math.floor((el._fsInner.offsetHeight - el.clientHeight) * 0.75))
        })
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cupitor-recorded-searches-${itemCount}.png`) })
      }
    }
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} Recorded Searches scrolling passed: ${native.rows} rows, ${native.height}px tall`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await checkScroll(browser, false)
    if (!process.argv.includes('--desktop-only')) await checkScroll(browser, true)
  }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
