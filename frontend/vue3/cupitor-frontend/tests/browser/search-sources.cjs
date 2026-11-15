const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures, clickSearchTool } = require('./language-dialogs.cjs')

async function checkMobileLabelTimeout(browser) {
  const page = await browser.newPage({ viewport: { width: 350, height: 800 }, isMobile: true, hasTouch: true })
  try {
    await page.clock.install()
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => {
      window.dontConfirmOnRefresh = true
      window.addEventListener('load', () => { window.__loadedAt = Date.now() }, { once: true })
    })
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'load' })
    await page.waitForFunction(() => document.querySelector('#mobileSearchSources #searchSourceChips'))
    const loadedAt = await page.evaluate(() => window.__loadedAt)
    await page.clock.pauseAt(new Date(loadedAt + 9950))
    const nav = page.getByRole('navigation', { name: 'Cupitor navigation' })
    const labels = nav.locator('.search-nav-label')
    const widths = () => labels.evaluateAll(items => items.map(el => el.getBoundingClientRect().width))
    assert.ok((await widths()).every(width => width > 1), 'labels remain visible before 10 seconds')
    await page.clock.runFor(100)
    assert.deepEqual(await widths(), [1, 1, 1, 1, 1], 'labels are visually hidden after 10 seconds')
    const names = ['Search', 'Playlists', 'Word Maps', 'Practice Log', 'Tools']
    for (const name of names) {
      const button = nav.getByRole('button', { name, exact: true })
      const bounds = await button.boundingBox()
      assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, name + ' stays named and tappable')
    }
    await page.clock.resume()
    await nav.getByRole('button', { name: 'Tools' }).tap()
    await page.getByRole('dialog', { name: 'Tools' }).waitFor()
    console.log('Mobile: navigation compresses after 10 seconds and remains named and usable')
  } finally {
    await page.close()
  }
}

async function checkHeader(page, mobile) {
  const shortcuts = [
    ['headerPlaylistsBtn', 'recordingReviewDialog'],
    ['headerWordMapsBtn', 'wordMapsDialog'],
    ['headerPracticeLogBtn', 'practiceLogDialog'],
    // The guest fixture follows the existing account setup flow for edits.
    ['headerAddToVocabBtn', 'accountDialog'],
  ]
  for (const [id] of shortcuts) assert.equal(await page.locator('#' + id).isVisible(), !mobile, id)
  const help = page.getByRole('button', { name: 'Cupitor help' })
  await help.focus()
  await page.keyboard.press('Enter')
  const helpDialog = page.getByRole('dialog', { name: 'Cupitor help' })
  assert.equal(await helpDialog.isVisible(), true)
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close help')
  await page.keyboard.press('Escape')
  await helpDialog.waitFor({ state: 'hidden' })
  assert.equal(await help.evaluate(el => el === document.activeElement), true)

  if (mobile) {
    const nav = page.getByRole('navigation', { name: 'Cupitor navigation' })
    assert.deepEqual(await nav.getByRole('button').allTextContents().then(text => text.map(s => s.trim())),
      ['Search', 'Playlists', 'Word Maps', 'Practice Log', 'Tools'])
    for (const [button, dialog] of shortcuts.slice(0, 3)) {
      await nav.locator(`[data-search-action="${button}"]`).click()
      const panel = page.locator('#' + dialog)
      await panel.waitFor({ state: 'visible' })
      await panel.evaluate(el => { if (el.tagName === 'DIALOG') el.close(); else window.jQuery(el).dialog('close') })
      await panel.waitFor({ state: 'hidden' })
    }

    const tools = nav.getByRole('button', { name: 'Tools' })
    await tools.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('dialog', { name: 'Tools' }).waitFor({ state: 'visible' })
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close tools')
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: 'Tools' }).waitFor({ state: 'hidden' })
    assert.equal(await tools.evaluate(el => el === document.activeElement), true)

    const header = page.locator('.subtitle-result-toggle').first()
    assert.equal(await header.getAttribute('aria-expanded'), 'false')
    await header.focus()
    await page.keyboard.press('Space')
    assert.equal(await header.getAttribute('aria-expanded'), 'true')
    await page.keyboard.press('Enter')
    assert.equal(await header.getAttribute('aria-expanded'), 'false')

    const language = page.getByRole('combobox', { name: 'Search language' })
    await language.selectOption('en')
    assert.equal(await page.locator('#toggleLangCb').isChecked(), true)
    await language.selectOption('sv')
    await page.waitForFunction(() => window._subtitleSearchCompletion?.complete && document.querySelector('#searchLoadingOverlay').hidden)

    const sourceRows = () => page.locator('#searchSourceChips label').evaluateAll(labels => {
      const rows = new Map()
      for (const label of labels) {
        const top = label.getBoundingClientRect().top
        rows.set(top, (rows.get(top) || 0) + 1)
      }
      return [...rows.values()]
    })
    await page.setViewportSize({ width: 350, height: 800 })
    assert.deepEqual(await sourceRows(), [4], 'the four filters fit on an ordinary phone')
    const chips = await page.locator('#searchSourceChips label').evaluateAll(labels => labels.map(label => ({
      target: label.getBoundingClientRect().height,
      visual: label.querySelector('.search-source-face').getBoundingClientRect().height,
    })))
    assert.ok(chips.every(({ target, visual }) => target >= 44 && visual === 30), 'compact chips keep a 44px hit area')
    const selectClips = page.getByRole('button', { name: 'Select clips for a playlist' })
    const clipSizes = await selectClips.evaluate(el => {
      const style = getComputedStyle(el, '::before')
      const target = el.getBoundingClientRect().height
      return { target, visual: target - parseFloat(style.top) - parseFloat(style.bottom) }
    })
    assert.deepEqual(clipSizes, { target: 44, visual: 27 })
    assert.equal(await page.locator('.mobile-vocab-title').evaluate(el => getComputedStyle(el).color), 'rgb(91, 109, 102)')
    assert.equal(await page.locator('.mobile-subtitle-title').evaluate(el => getComputedStyle(el).color), 'rgb(91, 109, 102)')

    const picker = page.locator('#searchedWords + .select2 .select2-selection')
    const fieldRow = page.locator('.lang-search-select-row .lang-select-with-toggle')
    const original = await picker.boundingBox()
    await picker.press('Enter')
    const dropdown = page.locator('.search-vocabulary-dropdown')
    await dropdown.waitFor({ state: 'visible' })
    const [row, active, menu] = await Promise.all([fieldRow.boundingBox(), picker.boundingBox(), dropdown.boundingBox()])
    assert.ok(active.width > original.width, 'opening Vocabulary expands the picker')
    for (const bounds of [active, menu]) {
      assert.ok(Math.abs(bounds.x - row.x) < 2 && Math.abs(bounds.width - row.width) < 2, 'picker and dropdown fill the row')
    }
    assert.equal(await language.isVisible(), false)
    const typeahead = dropdown.getByRole('searchbox', { name: 'Search vocabulary' })
    await typeahead.fill('färgsprakande')
    assert.ok((await dropdown.getByRole('option').allTextContents()).some(text => text.includes('färgsprakande')))
    await typeahead.press('Escape')
    await dropdown.waitFor({ state: 'hidden' })
    assert.equal(await language.isVisible(), true)
    assert.ok(Math.abs((await picker.boundingBox()).width - original.width) < 1, 'closing restores the picker width')

    assert.equal(await page.locator('#subtitle-container').isVisible(), false, 'idle captions take no space')
    assert.equal(await page.locator('#subtitleColumn').evaluate(el => getComputedStyle(el).borderLeftWidth), '0px')
    await page.setViewportSize({ width: 320, height: 700 })
    await page.locator('html').evaluate(el => { el.style.fontSize = '20px' })
    try {
      const sizes = await nav.getByRole('button').evaluateAll(buttons => buttons.map(button => {
        const bounds = button.getBoundingClientRect()
        return { width: bounds.width, height: bounds.height }
      }))
      assert.ok(sizes.every(({ width, height }) => width >= 44 && height >= 44), 'all nav buttons accommodate touch')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320, 'large text reflows at 320px')
      assert.deepEqual(await sourceRows(), [2, 2], 'larger text keeps the two rows balanced')
    } finally {
      await page.locator('html').evaluate(el => { el.style.fontSize = '' })
      await page.setViewportSize({ width: 390, height: 900 })
    }
    return
  }

  const assertDesktopLayout = async () => {
    const layout = await page.evaluate(() => {
      const bounds = selector => document.querySelector(selector).getBoundingClientRect().toJSON()
      const shortcuts = [...document.querySelectorAll('.lang-header-shortcuts button span')]
      return {
        toolbar: bounds('.lang-toolbar'), controls: bounds('.lang-toolbar-center'),
        chips: bounds('#searchSourceChips'), shortcuts: bounds('.lang-header-shortcuts'),
        search: bounds('#searchText'), viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        allLabelsVisible: shortcuts.every(label => label.getBoundingClientRect().width > 0),
      }
    })
    assert.ok(layout.allLabelsVisible, 'desktop shortcuts show their names')
    assert.ok(layout.shortcuts.bottom <= layout.chips.top && layout.chips.right <= layout.controls.left)
    assert.ok(layout.controls.right <= layout.toolbar.right && layout.shortcuts.right <= layout.toolbar.right)
    assert.ok(layout.search.width >= layout.viewport * .7, 'search uses the space freed by the idle caption pane')
    assert.equal(layout.viewport, layout.scrollWidth, 'desktop layout fits without horizontal scrolling')
  }
  const captions = page.locator('#subtitleColumn')
  assert.equal(await captions.isVisible(), false, 'the idle caption pane takes no space')
  for (const width of [1280, 1000]) {
    await page.setViewportSize({ width, height: 900 })
    await assertDesktopLayout()
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  const line = captions.locator('#sv-sub')
  await line.evaluate(el => { el.textContent = 'En färgsprakande kväll.' })
  assert.equal(await line.isVisible(), true, 'an active caption opens the split view')
  assert.ok((await captions.boundingBox()).x > (await page.locator('#searchText').boundingBox()).x)
  await line.evaluate(el => { el.textContent = '' })
  await captions.locator('#subControls').evaluate(el => { el.style.display = ''; el.firstElementChild.textContent = '1' })
  assert.equal(await captions.isVisible(), true, 'subtitle navigation opens the split before a cue arrives')
  await captions.locator('#subControls').evaluate(el => { el.style.display = 'none'; el.firstElementChild.textContent = '' })
  assert.equal(await captions.isVisible(), false)

  const options = page.getByRole('button', { name: 'Search options' })
  await options.press('Enter')
  assert.equal(await options.getAttribute('aria-expanded'), 'true')
  await page.keyboard.press('Tab')
  assert.equal(await page.getByRole('button', { name: 'Search by prefix' }).evaluate(el => el === document.activeElement), true)
  await page.keyboard.press('Escape')
  assert.equal(await options.getAttribute('aria-expanded'), 'false')
  assert.equal(await options.evaluate(el => el === document.activeElement), true)

  assert.equal(await page.getByRole('combobox', { name: 'Search language' }).isVisible(), true)
  assert.equal(await page.getByRole('heading', { name: 'Subtitle results' }).isVisible(), true)
  assert.equal(await page.getByRole('button', { name: 'Select clips for a playlist' }).innerText(), 'Select clips')

  for (const [button, dialog] of shortcuts) {
    await page.locator('#' + button).click()
    const panel = page.locator('#' + dialog)
    await panel.waitFor({ state: 'visible' })
    await panel.evaluate(el => {
      if (el.tagName === 'DIALOG') el.close()
      else window.jQuery(el).dialog('close')
    })
    await panel.waitFor({ state: 'hidden' })
  }
}

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
    await clickSearchTool(page, '#toggleSettingsPanelBtn')
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
    assert.deepEqual(await page.locator('#searchSourceChips span').allTextContents(), ['Books','SRTs','Maps','Cards'])
    assert.equal(await page.locator('#includeSrtsInSearchCb').isChecked(), true)
    for (const id of ['includeLibraryInSearchCb','wordMapSearchIncludeCb','manualSearchIncludeCb'])
      assert.equal(await page.locator('#' + id).isChecked(), false, 'only SRTs are enabled by default')
    await search('färgsprakande')
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, {recursive:true})
      await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR, `cupitor-search-chips-${mobile?'mobile':'desktop'}.png`)})
    }
    await checkHeader(page, mobile)
    await page.locator('#includeLibraryInSearchCb').check()
    await page.locator('#wordMapSearchIncludeCb').check()
    await page.locator('#manualSearchIncludeCb').check()
    await search('färgsprakande')
    assert.equal(await page.locator('#manualResults .manual-hit').count(), 1)
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 1)
    assert.equal(await page.locator('#result input#manualSearchIncludeCb, #result input#wordMapSearchIncludeCb').count(), 0)
    await page.locator('#librarySearchBtn').click()
    await push('färgsprakande')
    assert.match(await page.locator('#libraryResults').innerText(), /Book färgsprakande/)
    await page.evaluate(() => window.loadSearchResultsPage(0))
    assert.match(await page.locator('#libraryResults').innerText(), /Book färgsprakande/, 'paging the same query preserves its book results')

    await page.evaluate(() => {
      window.__searchRuns=0
      const run=window.cupitorSubtitleSearch.run
      window.cupitorSubtitleSearch.run=function(type,...args){
        if(['files','attribute','statistics','regroup'].includes(type))window.__searchRuns++
        return run.call(this,type,...args)
      }
    })
    await page.locator('#includeSrtsInSearchCb').uncheck()
    await page.waitForFunction(() => window._subtitleSearchCompletion?.disabled && document.querySelector('#searchLoadingOverlay').hidden)
    assert.equal(await page.locator('#result .l-accordion').count(), 0)
    assert.equal(await page.locator('#manualResults .manual-hit').count(), 1)
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 1)
    assert.equal(await page.evaluate(() => window.__searchRuns), 0, 'SRTs off skips the worker search entirely')
    await page.locator('#includeSrtsInSearchCb').check()
    await page.waitForFunction(() => window._subtitleSearchCompletion?.complete && !window._subtitleSearchCompletion.disabled)
    assert.ok(await page.locator('#result .l-accordion').count())

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
    await page.locator('#includeLibraryInSearchCb').uncheck()
    await page.locator('#manualSearchIncludeCb').uncheck()
    await page.locator('#wordMapSearchIncludeCb').uncheck()
    await page.locator('#includeSrtsInSearchCb').uncheck()
    assert.equal(await page.locator('#toggleAutoLibrarySearchCheckbox').isDisabled(), true)
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
    for (const id of ['includeLibraryInSearchCb', 'includeSrtsInSearchCb', 'manualSearchIncludeCb', 'wordMapSearchIncludeCb'])
      assert.equal(await page.locator('#' + id).isChecked(), false, id + ' persists after reload')
    assert.equal(await page.locator('#toggleAutoLibrarySearchCheckbox').isDisabled(), true)
    await page.locator('#includeLibraryInSearchCb').check()
    await openSettings()
    await page.locator('.settings-row').filter({ has: page.locator('#toggleAutoLibrarySearchCheckbox') }).locator('label').first().click()
    await closeSettings()
    await page.locator('#wordMapSearchIncludeCb').check()
    await page.locator('#includeSrtsInSearchCb').check()
    await search('färgsprakande')
    assert.equal(await page.locator('#wordMapResults .word-map-hit').count(), 1, 'source can be enabled again')

    for (const blank of ['', '   ']) {
      await page.locator('#manualSearchIncludeCb').check()
      await search('färgsprakande')
      await page.locator('#searchText').fill(blank)
      assert.equal(await page.locator('#result').innerText(), '')
      assert.equal(await page.locator('#vocabularyResult').innerText(), '')
      await page.locator('#manualSearchIncludeCb').uncheck()
      await page.locator('#manualSearchIncludeCb').check()
      await page.locator('#wordMapSearchIncludeCb').uncheck()
      await page.locator('#wordMapSearchIncludeCb').check()
      assert.equal(await page.locator('#result').innerText(), '', 'source toggles cannot revive cleared results')
    }

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
    await page.evaluate(() => {
      window.cupitorSubtitleSearch.run = async () => { throw new Error('The search worker stopped responding.') }
    })
    await search('hagla')
    assert.equal(await page.locator('#result [role="alert"]').count(), 1, 'show a single search error')
    assert.equal(await page.locator('#subtitleSearchStatus').isVisible(), false, 'do not repeat the same error above the results')
    await page.evaluate(() => { window.cupitorSubtitleSearch.run = window.__realRun })
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: saved search sources, book stream isolation and loading cancellation passed`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await check(browser, false); await check(browser, true); await checkMobileLabelTimeout(browser) }
  finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
