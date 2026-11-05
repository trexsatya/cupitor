const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(10000)
  page.setDefaultNavigationTimeout(30000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.__bridgeMessages = []
    window.PlaylistBridge = { postMessage: raw => window.__bridgeMessages.push(JSON.parse(raw)) }
    localStorage.setItem('cupitor:account', JSON.stringify({ login: null }))
    const mapKey = 'cupitor:wordMaps:swedish@~guest'
    if (!localStorage.getItem(mapKey)) localStorage.setItem(mapKey, JSON.stringify([
      { version: 1, id: 'colors', name: 'Colors', nodes: [{ id: 'a', word: 'färgsprakande', x: 0, y: 0 }], edges: [] }
    ]))
  })
  const openSettings = async () => {
    await page.locator('#toggleSettingsPanelBtn').click()
    if (mobile) await page.locator('.settings-section-picker select').selectOption('search')
    else await page.locator('[data-settings-section="search"]').click()
  }
  const closeSettings = () => page.locator('#settingsPanel').getByRole('button', { name: 'Done', exact: true }).click()
  const ready = async () => {
    await page.waitForFunction(() => !!(window.__cupitorSearchReady && window._vocabularyReadyPromise &&
      window._subtitlesReadyPromise), null, { timeout: 30000 })
    await page.evaluate(() => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
  }
  const search = async query => {
    await page.locator('#searchText').fill(query)
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(query => window._vocabularySearchText === query &&
      document.querySelector('#result').getAttribute('aria-busy') === 'false', query)
  }
  const push = (query, done = true) => page.evaluate(({ query, done }) => {
    window.dispatchEvent(new CustomEvent('cupitorGlobalSearchResults', { detail: {
      query, done, hits: [{ book_key: query, book_title: 'Book ' + query, chapter_idx: 0,
        snippets: [{ match: query, before: 'Before ', after: ' after' }] }]
    } }))
  }, { query, done })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'domcontentloaded' })
    await ready()
    await page.evaluate(async () => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window._recordings.Fixture = { items: { Manual: { Card: [
        { manual: true, id: 'color', source: 'En färgsprakande kväll', target: 'A colorful evening' }
      ] } } }
      // Check real intermediate DOM states while rendering yields between
      // headings/context. A removed text placeholder is insufficient here.
      window.__loadingChecks = { partial: 0, uncovered: 0, completed: 0 }
      const result = document.querySelector('#result')
      const overlay = document.querySelector('#searchLoadingOverlay')
      const check = () => {
        const unfinished = [...result.querySelectorAll('.l-accordion')].some(el => !el.hasAttribute('accordion-rendered'))
        if (unfinished) {
          window.__loadingChecks.partial++
          if (overlay.hidden) window.__loadingChecks.uncovered++
        }
      }
      new MutationObserver(check).observe(result, { childList: true, subtree: true, attributes: true })
      new MutationObserver(() => {
        check()
        if (overlay.hidden) window.__loadingChecks.completed++
      }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] })
    })
    await openSettings()
    assert.equal(await page.locator('#includeLibraryInSearchCb').isChecked(), true)
    assert.equal(await page.locator('#wordMapSearchIncludeCb').isChecked(), true)
    await page.locator('#manualSearchIncludeCb').check()
    await closeSettings()
    await search('färgsprakande')
    assert.equal(await page.locator('#manualResults .manual-hit').count(), 1)
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 1)
    assert.equal(await page.locator('#result input#manualSearchIncludeCb, #result input#wordMapSearchIncludeCb').count(), 0)
    await page.locator('#librarySearchBtn').click()
    await push('färgsprakande')
    assert.match(await page.locator('#libraryResults').innerText(), /Book färgsprakande/)
    await page.evaluate(() => window.loadSearchResultsPage(0))
    assert.match(await page.locator('#libraryResults').innerText(), /Book färgsprakande/, 'paging the same query preserves its book results')

    await search('hagla')
    assert.equal(await page.locator('#libraryResults').innerText(), '', 'new subtitle query clears completed book results')
    await push('färgsprakande')
    assert.equal(await page.evaluate(() => window._librarySearchLast), null, 'late completed response is discarded')
    await page.locator('#librarySearchBtn').click()
    await push('färgsprakande')
    assert.equal(await page.locator('#libraryResults').innerText(), '', 'old response cannot enter a new book stream')
    await push('hagla', false)
    await page.waitForFunction(() => document.querySelector('#libraryResults').textContent.includes('Book hagla'))
    await push('hagla', false) // schedules a throttled repaint
    await search('cykel')
    await push('hagla')
    await page.waitForTimeout(300)
    assert.equal(await page.locator('#libraryResults').innerText(), '', 'cancelled stream and queued paints cannot restore old results')
    assert.ok(await page.evaluate(() => window.__bridgeMessages.some(message => message.op === 'cancelSearch')))

    // Disabled sources are absent and cannot run, even with auto mode saved.
    await openSettings()
    await page.locator('#includeLibraryInSearchCb').uncheck()
    await page.locator('#manualSearchIncludeCb').uncheck()
    await page.locator('#wordMapSearchIncludeCb').uncheck()
    assert.equal(await page.locator('#toggleAutoLibrarySearchCheckbox').isDisabled(), true)
    await closeSettings()
    await page.evaluate(() => { window._appSettings.autoLibrarySearch = true; window.saveAppSettings(); window.__bridgeMessages = [] })
    await search('färgsprakande')
    await page.waitForTimeout(450)
    assert.equal(await page.locator('#librarySearchBar, #libraryResults, #manualResults, #wordMapResults').count(), 0)
    assert.equal(await page.evaluate(() => window.librarySearch('färgsprakande')), false)
    assert.equal(await page.evaluate(() => window.__bridgeMessages.filter(message => message.op === 'globalSearch').length), 0)
    const loading = await page.evaluate(() => window.__loadingChecks)
    assert.ok(loading.partial > 0, 'observe intermediate, unwired accordion DOM')
    assert.ok(loading.completed > 0, 'loader finishes after rendering')
    assert.equal(loading.uncovered, 0, 'unwired accordions always stay covered by the overlay')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await ready()
    await openSettings()
    for (const id of ['includeLibraryInSearchCb', 'manualSearchIncludeCb', 'wordMapSearchIncludeCb'])
      assert.equal(await page.locator('#' + id).isChecked(), false, id + ' persists after reload')
    assert.equal(await page.locator('#toggleAutoLibrarySearchCheckbox').isDisabled(), true)
    await page.locator('#includeLibraryInSearchCb').check()
    await page.locator('.settings-row').filter({ has: page.locator('#toggleAutoLibrarySearchCheckbox') }).locator('label').first().click()
    await page.locator('#wordMapSearchIncludeCb').check()
    await closeSettings()
    await search('färgsprakande')
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 1, 'source can be enabled again')

    // Errors and cancellation release the overlay too.
    await search('[ab')
    assert.match(await page.locator('#result').innerText(), /Invalid regular expression/)
    await page.evaluate(() => {
      window.__realRun = window.cupitorSubtitleSearch.run
      window.cupitorSubtitleSearch.run = () => new Promise(resolve => { window.__releaseSearch = resolve })
      $('#searchText').val('färgsprakande').trigger('change')
    })
    await page.locator('#searchLoadingOverlay').waitFor({ state: 'visible' })
    await page.locator('.subtitle-search-cancel').click()
    await page.locator('#searchLoadingOverlay').waitFor({ state: 'hidden' })
    await page.evaluate(() => { window.__releaseSearch([]); window.cupitorSubtitleSearch.run = window.__realRun })
    // A superseded request finishing late cannot uncover the new query.
    await page.evaluate(() => {
      window.__requests = []
      window.cupitorSubtitleSearch.run = () => new Promise(resolve => window.__requests.push(resolve))
      $('#searchText').val('hagla').trigger('change')
    })
    await page.waitForFunction(() => window.__requests.length === 1)
    await page.evaluate(() => { $('#searchText').val('cykel').trigger('change') })
    await page.waitForFunction(() => window.__requests.length === 2)
    await page.evaluate(() => window.__requests[0]([]))
    await page.waitForTimeout(20)
    assert.equal(await page.locator('#searchLoadingOverlay').isVisible(), true, 'old query cannot hide the current loader')
    await page.locator('.subtitle-search-cancel').click()
    await page.evaluate(() => { window.__requests[1]([]); window.cupitorSubtitleSearch.run = window.__realRun })
    await page.locator('#searchLoadingOverlay').waitFor({ state: 'hidden' })
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: saved search sources, book stream isolation and loading cancellation passed`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true) }
  finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
