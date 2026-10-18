// Fixture playlists only. Native touch, wheel and drag-reorder checks; no
// account, repository or native app data is changed.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const itemCount = process.argv.includes('--huge') ? 10000 : 600

// Dispatch trusted touch input so Chromium itself scrolls. Synthetic DOM
// TouchEvents do not run the browser's native scrolling default action.
async function swipe(page, session, dy) {
  const box = await page.locator('#recordingReviewDialog').boundingBox()
  const x = box.x + box.width / 2
  const y = dy < 0 ? box.y + box.height - 35 : box.y + 35
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 12; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * i / 12 }] })
    await page.waitForTimeout(16)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function checkScroll(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push('Unexpected dialog: ' + d.message()); d.dismiss() })
  if (itemCount > 600) page.on('console', m => {
    if (m.text().startsWith('[recorded-scroll]')) console.log(m.text())
  })
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
      await frames()
      const el = document.getElementById('recordingReviewDialog')
      window._scrollTest = { el, frames }
      const deepNative = []
      const max = el.scrollHeight - el.clientHeight
      for (const top of [Math.floor(max / 2), max - 100]) {
        el.scrollTop = top
        window.openRecordingReviewDialog()
        await frames()
        deepNative.push({ wanted: top, actual: el.scrollTop })
        console.info('[recorded-scroll] refreshed at ' + el.scrollTop)
      }
      el.scrollTop = 800
      window.openRecordingReviewDialog()
      await frames()
      const refreshed = el.scrollTop
      // A user scroll after rendering must survive all pending preview work.
      el.scrollTop = 1000
      await frames(20)
      const afterPreviews = el.scrollTop
      window._recordings.Other = { items }
      window._recording.currentName = 'Other'
      window.openRecordingReviewDialog()
      await frames()
      const switched = el.scrollTop
      window._recording.currentName = 'Scroll test'
      window.openRecordingReviewDialog()
      await frames()
      el.scrollTop = 1000
      return { height: el.scrollHeight, rows: el.querySelectorAll('.rec-item').length,
        deepNative, refreshed, afterPreviews, switched }
    }, itemCount)
    assert.equal(native.rows, Math.min(50, itemCount), 'only a bounded page enters the DOM')
    assert(native.deepNative.every(p => p.actual === p.wanted), 'deep native positions survive refresh')
    assert(native.height < 16384, 'a huge playlist must not create an oversized scroll surface')
    assert.equal(native.refreshed, 800)
    assert.equal(native.afterPreviews, 1000, 'pending previews cannot overwrite a newer user scroll')
    assert.equal(native.switched, 0, 'switching playlists starts at the beginning')

    for (const p of [Math.ceil(itemCount / 100), Math.ceil(itemCount / 50), 1]) {
      await page.locator('.rec-page-input').first().fill(String(p))
      await page.locator('.rec-page-input').first().press('Tab')
      const start = (p - 1) * 50 + 1
      assert.equal(await page.locator('#recordingReviewDialog .rec-item-no').first().innerText(), String(start))
      assert.equal(await page.locator('#recordingReviewDialog .rec-item').count(), Math.min(50, itemCount - start + 1))
    }
    await page.locator('#recordingReviewDialog').evaluate(el => { el.scrollTop = 1000 })

    if (!mobile) {
      const box = await page.locator('#recordingReviewDialog').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.wheel(0, 240)
      await page.waitForFunction(() => document.getElementById('recordingReviewDialog').scrollTop > 1100)
      await page.evaluate(async () => { const { el, frames } = window._scrollTest; el.scrollTop = 0; await frames() })
      const first = await page.locator('#recordingReviewDialog .rec-item:nth-child(1) .rec-drag').boundingBox()
      const third = await page.locator('#recordingReviewDialog .rec-item:nth-child(3) .rec-drag').boundingBox()
      await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2)
      await page.mouse.down()
      await page.mouse.move(third.x + third.width / 2, third.y + third.height / 2, { steps: 10 })
      await page.mouse.up()
      await page.waitForFunction(() => window._recording.items.word.word[0].id !== 'mc-0', undefined, { timeout: 10000 })
      assert.equal(await page.locator('#recordingReviewDialog .rec-item-no').first().innerText(), '1')
      assert.equal(await page.evaluate(() => window._recording.items.word.word.length), itemCount, 'dragging retains items on other pages')
    } else {
      // Repeated DOM-only gestures must never activate a page-driven scroller
      // or cancel touchmove. This reproduces the old rescue's two-miss trigger.
      const passive = await page.evaluate(async () => {
        const { el, frames } = window._scrollTest
        const target = el.querySelector('.rec-item-text')
        const before = el.scrollTop
        let prevented = 0
        for (let i = 0; i < 4; i++) {
          for (const [type, y] of [['touchstart', 450], ['touchmove', 410], ['touchmove', 330], ['touchend', 330]]) {
            const point = new Touch({ identifier: 1, target, clientX: 180, clientY: y })
            const event = new TouchEvent(type, { bubbles: true, cancelable: true,
              touches: type === 'touchend' ? [] : [point], changedTouches: [point] })
            target.dispatchEvent(event)
            if (event.defaultPrevented) prevented++
          }
          await new Promise(resolve => setTimeout(resolve, 180))
        }
        await frames()
        return { before, after: el.scrollTop, prevented }
      })
      assert.equal(passive.prevented, 0, 'ordinary vertical touches stay available to the browser')
      assert.equal(passive.after, passive.before, 'the page cannot synthesize scroll or momentum')

      const session = await page.context().newCDPSession(page)
      // Cover both a huge list and a 35-item captured-clip list like the report.
      for (const short of [false, true]) {
        await page.evaluate(async short => {
          const { el, frames } = window._scrollTest
          if (short) {
            const items = Object.fromEntries(Array.from({ length: 35 }, (_, i) =>
              ['word ' + i, { word: [{ id: 'testVideo01', timeStart: 1, timeEnd: 3, lineIndex: 0, word: 'kväll' }] }]))
            window._recordings.Short = { items }
            window._recording = { state: 'idle', currentName: 'Short', items }
            window.openRecordingReviewDialog()
          }
          el.scrollTop = 600
          await frames(20)
          window._nativeTouchCheck = { prevented: 0 }
          el.addEventListener('touchmove', e => {
            if (e.defaultPrevented) window._nativeTouchCheck.prevented++
          }, { passive: true })
        }, short)
        await swipe(page, session, -220)
        await page.waitForFunction(() => document.getElementById('recordingReviewDialog').scrollTop > 700)
        await page.waitForTimeout(600)
        const down = await page.locator('#recordingReviewDialog').evaluate(el => el.scrollTop)
        await page.waitForTimeout(300)
        const settled = await page.locator('#recordingReviewDialog').evaluate(el => el.scrollTop)
        assert(settled >= down - 1, 'scroll must not reverse or snap back after lifting')
        await swipe(page, session, 220)
        await page.waitForFunction(before => document.getElementById('recordingReviewDialog').scrollTop < before - 80, settled)
        assert.equal(await page.evaluate(() => window._nativeTouchCheck.prevented), 0)
        if (process.env.SCREENSHOT_DIR) {
          fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
          await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cupitor-recorded-searches-${short ? 35 : itemCount}.png`) })
        }
      }
      await session.detach()
      // Wide content still has native horizontal scrolling.
      const sideways = await page.evaluate(async () => {
        const { el, frames } = window._scrollTest
        el.firstElementChild.style.minWidth = '1200px'
        el.scrollLeft = 100
        await frames()
        const left = el.scrollLeft
        el.firstElementChild.style.minWidth = ''
        el.scrollLeft = 0
        return left
      })
      assert.equal(sideways, 100)
    }
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} native Recorded Searches scrolling passed: ${itemCount} items, ${native.rows} rendered rows, ${native.height}px tall`)
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
