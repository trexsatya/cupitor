// Trusted touch input on the main results page, including transitions from
// scrolling an actual dialog back to scrolling the document. No JS drag shim.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')
const { choosePlaylist } = require('./recorded-playlist-pages.cjs')
const playlists = require('./fixtures/recorded-playlists.json').playlists

async function swipe(page, session, direction, bounds) {
  const x = bounds.x + bounds.width * .55
  const y = bounds.y + bounds.height * (direction < 0 ? .8 : .2)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 8; i++) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
      touchPoints: [{ x, y: y + direction * i * bounds.height * .06 }] })
    await page.waitForTimeout(20)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(900)
}

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 393 : 1280, height: 780 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(10000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.locator('#searchText').fill('färgsprakande')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(() => document.querySelector('#result .srt-file') &&
      !document.querySelector('#result').textContent.includes('Loading…'))
    // Reuse real subtitle data and the real pagination/rendering path. More
    // than a page of headings also exercises a footer-triggered page change.
    await page.evaluate(async () => {
      const items = Object.values(window._lastWordToItemsMap).find(items => items.length)
      window._shownWordToItemsMap = Object.fromEntries(
        Array.from({ length: 65 }, (_, i) => ['ord' + String(i).padStart(3, '0'), items]))
      window.SEARCH_RESULT_PAGE_SIZE = 50
      await window.loadSearchResultsPage(0)
    })
    assert.equal(await page.locator('#result .l-accordion').count(), 50)
    const metrics = () => page.locator('#result').evaluate(el => ({
      top: el.scrollTop, height: el.clientHeight, content: el.scrollHeight,
      overflow: getComputedStyle(el).overflowY, root: window.scrollY,
    }))
    if (!mobile) {
      const before = await metrics()
      assert.equal(before.overflow, 'scroll')
      assert(before.content > before.height, 'desktop keeps its bounded results list')
      await page.locator('#result').hover()
      await page.mouse.wheel(0, 400)
      await page.waitForFunction(() => document.getElementById('result').scrollTop > 0)
      console.log('Desktop: independent results scrolling preserved')
      return
    }

    const m = await metrics()
    assert.equal(m.overflow, 'visible', 'mobile uses one document scroll surface')
    assert(m.content <= m.height + 1, 'the results cannot trap a pan in a nested scroll box')
    const session = await page.context().newCDPSession(page)
    await page.evaluate(() => {
      window._preventedScrollMoves = 0
      window.addEventListener('touchmove', e => {
        if (e.defaultPrevented) window._preventedScrollMoves++
      }, { passive: true })
    })
    const pageSwipe = async direction => {
      const start = await page.evaluate(() => {
        const el = document.getElementById('result')
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 500, behavior: 'instant' })
        return window.scrollY
      })
      await swipe(page, session, direction, { x: 10, y: 80, width: 350, height: 600 })
      const after = await metrics()
      assert(direction < 0 ? after.root > start + 60 : after.root < start - 60,
        'the document scrolls in the requested direction: ' + JSON.stringify({ direction, start, after }))
      assert.equal(after.top, 0, 'no second results scroll offset')
    }
    for (const direction of [-1, 1, -1]) await pageSwipe(direction)

    const rootBeforeDialog = await page.evaluate(() => window.scrollY)
    await page.evaluate(playlists => {
      window._recordings = { Default: { items: {} }, ...playlists }
      window.openRecordingReviewDialog()
    }, playlists)
    await choosePlaylist(page, Object.keys(playlists)[0], true)
    const dialog = page.locator('#recordingReviewDialog')
    await dialog.waitFor({ state: 'visible' })
    await page.waitForFunction(() => {
      const el = document.getElementById('recordingReviewDialog')
      return el.scrollHeight > el.clientHeight
    })
    await swipe(page, session, -1, await dialog.boundingBox())
    assert(await dialog.evaluate(el => el.scrollTop > 0), 'dialog still scrolls natively')
    assert.equal(await page.evaluate(() => window.scrollY), rootBeforeDialog, 'dialog pans leave results in place')
    await page.evaluate(() => $('#recordingReviewDialog').dialog('close'))
    await pageSwipe(-1)
    await pageSwipe(1)

    // The browser keyboard and rotation can change viewport height/width.
    await page.setViewportSize({ width: 780, height: 393 })
    await page.setViewportSize({ width: 393, height: 780 })
    await pageSwipe(-1)

    await page.locator('#searchNextPageButton').tap()
    await page.waitForFunction(() => window._searchResultPage === 1 &&
      document.querySelectorAll('#result .l-accordion').length === 15)
    await page.waitForFunction(() => Math.abs(document.getElementById('result').getBoundingClientRect().top) < 2)
    assert.equal((await metrics()).top, 0)
    assert.equal(await page.evaluate(() => window._preventedScrollMoves), 0, 'native touch moves are never cancelled')
    await session.detach()
    console.log('Mobile: bidirectional results swipes, dialog round trip, rotation and pagination passed')
  } catch (error) {
    console.error(await page.evaluate(() => ({
      root: window.scrollY, playlist: window._recording?.currentName,
      names: Object.keys(window._recordings || {}),
      selected: document.getElementById('recRecSelect')?.value,
      dropdownOpen: !!document.querySelector('.select2-dropdown'),
      dialogRows: document.querySelectorAll('#recordingReviewDialog .rec-item').length,
    })))
    throw error
  } finally {
    assert.deepEqual(errors, [])
    await page.close()
  }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, true); await check(browser, false) }
  finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
