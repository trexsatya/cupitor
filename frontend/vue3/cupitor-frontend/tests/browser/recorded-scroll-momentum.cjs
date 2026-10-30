// Phone-browser scrolling with fast flicks, concurrent refreshes and viewport
// changes. Exercise full lists too, so pagination cannot conceal a failure.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { fixtures, choosePlaylist } = require('./recorded-playlist-pages.cjs')
const data = require('./fixtures/recorded-playlists.json')
const root = path.resolve(__dirname, '../..', process.env.CUPITOR_TEST_ASSETS || 'public')

async function flick(page, session, box) {
  const x = box.x + box.width * .6, y = box.y + box.height * .85
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 6; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 35 }] })
    await page.waitForTimeout(8)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function checkMomentum(browser, full) {
  const page = await browser.newPage({ viewport: { width: 393, height: 780 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 16; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36' })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (full && url.hostname === '127.0.0.1') {
      // Keep the original module's directory: its relative imports (including
      // versioned production imports) must resolve under /language/ too.
      if (url.pathname === '/language/_scroll-test-review-page.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(root, 'language/recording-review-page.js')) })
      if (url.pathname === '/language/recording-review-page.js') return route.fulfill({ contentType: 'application/javascript', body:
        'import {recordingReviewPage as original,recordingReviewOrder} from "/language/_scroll-test-review-page.js";export {recordingReviewOrder};export function recordingReviewPage(items){return original(items,0,Number.MAX_SAFE_INTEGER)}' })
    }
    return fixtures(route)
  })
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async data => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window._recordings = data.playlists
      data.otherNames.forEach(name => { window._recordings[name] = { items: {} } })
      const pad = document.createElement('div')
      pad.style.height = '30000px'
      document.body.appendChild(pad)
      window._momentumTrace = { active: false, samples: [], prevented: 0 }
      const sample = () => {
        const trace = window._momentumTrace, el = document.getElementById('recordingReviewDialog')
        if (trace.active && el) trace.samples.push({ top: el.scrollTop, root: window.scrollY, dialog: el.parentElement.getBoundingClientRect().top })
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
      window.addEventListener('touchmove', e => {
        if (window._momentumTrace.active && e.defaultPrevented) window._momentumTrace.prevented++
      }, { passive: true })
    }, data)
    const session = await page.context().newCDPSession(page)
    await page.evaluate(() => window.openRecordingReviewDialog())
    for (const [name, rec] of Object.entries(data.playlists)) {
      await choosePlaylist(page, name, true)
      await page.waitForFunction(() => !document.querySelector('#recordingReviewDialog [data-pending]'))
      const total = Object.values(rec.items).flatMap(words => Object.values(words).flat()).length
      assert.equal(await page.locator('#recordingReviewDialog .rec-item').count(), full ? total : 50)
      for (const mode of ['plain', 'refresh', 'resize', 'picker-refresh']) {
        if (mode === 'picker-refresh') {
          // A native playlist update can rebuild the dialog while the user
          // is still searching in its picker, without selecting an option.
          await page.locator('#recordingReviewDialog .rec-rec-header .select2-selection').tap()
          await page.evaluate(() => window.openRecordingReviewDialog())
          assert.equal(await page.locator('.select2-dropdown').count(), 0)
        }
        const start = await page.locator('#recordingReviewDialog').evaluate((el, mode) => {
          window.scrollTo({ top: 5000, behavior: 'instant' })
          el.scrollTop = Math.min(2500, Math.floor((el.scrollHeight - el.clientHeight) / 2))
          Object.assign(window._momentumTrace, { active: true, samples: [], prevented: 0 })
          if (mode === 'refresh') window._momentumRefresh = setInterval(() => window.openRecordingReviewDialog(), 80)
          return el.scrollTop
        }, mode)
        const gesture = flick(page, session, await page.locator('#recordingReviewDialog').boundingBox())
        if (mode === 'resize') {
          await page.waitForTimeout(80)
          await page.setViewportSize({ width: 393, height: 700 })
          await page.waitForTimeout(120)
          await page.setViewportSize({ width: 393, height: 780 })
        }
        await gesture
        await page.waitForTimeout(1100)
        const trace = await page.evaluate(() => {
          clearInterval(window._momentumRefresh)
          window._momentumTrace.active = false
          return window._momentumTrace
        })
        assert(trace.samples.length > 10, 'sample the gesture and settling frames')
        assert(trace.samples.at(-1).top > start + 100, 'trusted fast touch input scrolls the list')
        assert(trace.samples.every((s, i) => !i || s.top >= trace.samples[i - 1].top - 1), 'downward scrolling never reverses')
        assert(trace.samples.every(s => s.root === 5000), 'the page behind the playlist stays still')
        assert(trace.samples.every(s => s.dialog === 20), 'the dialog stays pinned during refreshes and viewport changes')
        assert.equal(trace.prevented, 0, 'page handlers leave native touch scrolling available')
        console.log(`Phone emulation ${full ? 'full list' : 'paged'}: ${name}, ${mode} passed`)
      }
    }
    await session.detach()
    assert.deepEqual(errors, [])
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await checkMomentum(browser, false); await checkMomentum(browser, true) }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
