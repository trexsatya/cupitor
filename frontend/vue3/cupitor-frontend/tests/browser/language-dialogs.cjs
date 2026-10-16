// Run with: node tests/browser/language-dialogs.cjs
// Install a browser with `npx playwright install chromium`, or set
// PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Optional: SCREENSHOT_DIR.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '../../public')
const index = [
  { link: 'testVideo01', name: 'Ljudbok Klubb || HARRY POTTER och FÅNGEN FRÅN AZKABAN || testVideo01', source: 'YouTube' },
  { link: 'testVideo02', name: 'Anders på landet || Höns i trädgård || testVideo02', source: 'youtube' },
  { link: 'testVideo03', name: 'Ljudbok Klubb||ROBINSON CRUSOE||testVideo03', source: 'YOUTUBE' }
]
const cue = '1\n00:00:01,000 --> 00:00:03,000\nEn färgsprakande kväll. Han är en översittare.\n\n2\n00:00:03,000 --> 00:00:05,000\nDet börjar hagla.\n\n3\n00:00:05,000 --> 00:00:07,000\nEn stor väljarkår.\n\n4\n00:00:07,000 --> 00:00:09,000\nJag hörde översittarens röst. Det haglade.\n\n5\n00:00:09,000 --> 00:00:11,000\nCyklarnas färg. Han uppskattar måleriet. Jag har sovit. Allt går an.\n'

async function serveFixtures(route) {
  const url = new URL(route.request().url())
  if (url.hostname === '127.0.0.1') {
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname))
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
      return route.fulfill({ status: 404, body: '' })
    }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' }
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' })
  }
  const file = decodeURIComponent(url.pathname)
  let body = '{}'
  let contentType = 'application/json'
  if (file.endsWith('/srts/index.json')) body = JSON.stringify(index)
  else if (file.endsWith('/vocabulary.txt')) {
    body = '#Color\n(colorful)|färgsprakande|\n(stain)|färg|\n#Sound\n(crackle)|spraka|sprakande|\n#Conduct\n(bully)|översittare|\n(bullying)|översitteri|\n(spelling neighbor)|översittaraktig|\n(spelling neighbor)|översittarfasoner|\n#Language\n(translate)|översätta|\n#Weather\n(hail verb)|hagla|\n(hail)|hagel(sl-pl)|hagelskur|hagelskurar|hagelkorn(sl-pl)\n(pastures)|hagar|\n#People\n(choose)|välja|\n(corps)|kår|kårar|\n(year)|år|\n#Objects\n(bicycle)|cykel|\n(painter)|målare|\n(sleep)|sova|\n#Phrases\n(acceptable)|<*gå an|\n#Common-word noise\n(noise only)|se till|\n(noise only)|till!|\n(noise only)|för|\n(noise only)|för sig|\n#Manufacturing\n(manufacture)|tillverka|tillverkning|\n#Expansions\nsova=sova,sover,sov,sovit\ngå=gå,går,gick,gått\n'
    contentType = 'text/plain'
  } else if (file.endsWith('.srt')) {
    body = cue
    contentType = 'text/plain'
  } else if (file.endsWith('/categorisation.txt')) {
    body = ''
    contentType = 'text/plain'
  } else if (file.endsWith('/users.json')) body = '[]'
  else if (url.hostname === 'api.github.com') return route.fulfill({ status: 404, body: '{}' })
  else if (['script', 'stylesheet'].includes(route.request().resourceType())) {
    body = ''
    contentType = route.request().resourceType() === 'script' ? 'application/javascript' : 'text/css'
  }
  return route.fulfill({ body, contentType })
}

async function checkDialogs(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 430, height: 900 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(10000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const click = selector => mobile ? page.locator(selector).tap() : page.locator(selector).click()
  const isOpen = id => page.evaluate(id => $('#' + id).dialog('isOpen'), id)
  const screenshot = async name => {
    if (!mobile || !process.env.SCREENSHOT_DIR) return
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, name + '.png') })
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.waitForFunction(() => window.srts?.length === 3)
    await page.evaluate(async () => { await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]) })
    // Related vocabulary must survive both the ordinary finder and the
    // automatic prefix pass, even when subtitles already match the exact
    // typed word (so subtitle stem fallback never runs).
    for (const autoPrefix of [false, true]) {
      await click('#toggleSettingsPanelBtn')
      if (await page.locator('#toggleAutoPrefixSearchCheckbox').isChecked() !== autoPrefix) {
        await click('#settingsPanel label[for="toggleAutoPrefixSearchCheckbox"] .slider')
      }
      await page.locator('#numberOfPrefixFindings').fill('1')
      await page.locator('#numberOfPrefixFindings').press('Tab')
      await page.locator('#settingsPanel').locator('..').locator('.ui-dialog-titlebar-close').click()
      for (const [query, expected] of [['översittare', 'översitteri'], ['översittarens', 'översitteri'], ['hagla', 'hagel'], ['haglade', 'hagel'], ['väljarkår', '(corps)'], ['cyklarnas', 'cykel'], ['måleriet', 'målare'], ['sovit', 'sova'], ['går an', '(acceptable)'], ['färgsprakande', '(crackle)']]) {
        await page.locator('#searchText').fill(autoPrefix ? query : query.toUpperCase())
        await page.locator('#searchText').press('Tab')
        await page.waitForFunction(({ expected, query }) => {
          const headers = [...document.querySelectorAll('#vocabularyResult .similar-segment-header')]
          return headers.some(h => h.textContent.includes(expected)) &&
            Object.keys(window._lastWordToItemsMap || {}).includes(query) &&
            !document.querySelector('#result').textContent.includes('Loading…')
        }, { expected, query })
        const row = page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: expected })
        assert.equal(await row.count(), 1)
        await row.waitFor({ state: 'visible' })
        for (const unrelated of ['översätta', 'hagar', '(year)']) {
          assert.equal(await page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: unrelated }).count(), 0)
        }
        assert.equal(await page.evaluate(() => window._librarySearchText), query, 'vocabulary matching must not broaden the clean search query')
        assert((await page.evaluate(() => Object.values(window._lastWordToItemsMap || {}).flat().length)) > 0)
        assert.equal(await row.isVisible(), true, 'valid matches remain visible even with the prefix limit set to one')
        assert.equal(await row.locator('xpath=ancestor::*[contains(@class, "prefix-group")]').count(), 0)
        if (query === 'översittare') {
          assert.equal(await page.locator('#vocabularyResult [data-vocab-match-kind=exact]').count(), 1)
          assert.equal(await page.locator('#vocabularyResult [data-vocab-match-kind=family]').count(), 1)
          if (autoPrefix) assert(await page.locator('#showDiffPrefixesBtn').innerText().then(t => t.includes('+1 more')))
        }
        if (autoPrefix && query === 'väljarkår') await screenshot('cupitor-vocabulary-general-matching')
      }
    }
    // History and manual prefix searches use the same retained findings.
    await click('#prevSearchBtn')
    await page.waitForFunction(() => window._librarySearchText === 'går an' && !document.querySelector('#result').textContent.includes('Loading…'))
    await page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: '(acceptable)' }).waitFor({ state: 'visible' })
    await click('#nextSearchBtn')
    await page.waitForFunction(() => window._librarySearchText === 'färgsprakande' && !document.querySelector('#result').textContent.includes('Loading…'))
    await click('#searchVocabularyByPrefixBtn')
    await click('#searchVocabularyMenu [data-mode=prefix]')
    await page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: '(crackle)' }).waitFor({ state: 'visible' })
    assert.equal(await page.evaluate(() => window._librarySearchText), 'färgsprakande')
    // Common words cannot be the sole match, including alternatives,
    // punctuation and prefix suggestions. Complete expressions still work.
    for (const autoPrefix of [false, true]) {
      await click('#toggleSettingsPanelBtn')
      if (await page.locator('#toggleAutoPrefixSearchCheckbox').isChecked() !== autoPrefix) {
        await click('#settingsPanel label[for="toggleAutoPrefixSearchCheckbox"] .slider')
      }
      await page.locator('#settingsPanel').locator('..').locator('.ui-dialog-titlebar-close').click()
      for (const query of ['tillverkning', 'till|tillverkning', 'för|tillverkning']) {
        await page.evaluate(query => window.renderVocabularyFindings(query), query)
        const headers = page.locator('#vocabularyResult .similar-segment-header')
        assert.equal(await headers.count(), 1)
        assert.match(await headers.innerText(), /manufacture/)
      }
      await page.evaluate(() => window.renderVocabularyFindings('till!|för'))
      assert.equal(await page.locator('#vocabularyResult .vocabulary-segment').count(), 0)
      await page.evaluate(() => window.renderVocabularyFindings('se till'))
      const expression = page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: 'se till' })
      await expression.waitFor({ state: 'visible' })
      assert.equal(await expression.count(), 1)
    }
    // Same-size edits must invalidate the compiled vocabulary index.
    await page.evaluate(() => { window.vocabulary.CacheCheck = ['(cache)|gammal|']; window.renderVocabularyFindings('gamla') })
    assert(await page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: 'gammal' }).count())
    await page.evaluate(() => { window.vocabulary.CacheCheck[0] = '(cache)|cykel|'; window.renderVocabularyFindings('gamla') })
    assert.equal(await page.locator('#vocabularyResult .similar-segment-header').filter({ hasText: 'gammal' }).count(), 0)
    await page.evaluate(() => window.renderVocabularyFindings(window.searchText))
    assert.equal(await page.locator('#settingsPanel #searchChannelsBtn').count(), 1)
    assert.equal(await page.locator('#searchChannelsBtn:visible').count(), 0)
    await page.locator('#searchText').fill('färgsprakande')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(() => window._lastWordToItemsMap && !document.querySelector('#result').textContent.includes('Loading…'))
    await click('#toggleSettingsPanelBtn')
    await page.locator('#settingsPanel').waitFor({ state: 'visible' })
    await page.locator('#numberOfFindingsToShow').fill('2')
    await page.locator('#numberOfFindingsToShow').press('Tab')
    assert.equal(await isOpen('settingsPanel'), true)
    await page.locator('#settingsPanel').locator('..').focus()
    await screenshot('cupitor-settings-search-channels')
    await click('#searchChannelsBtn')
    await page.locator('#searchChannelsDialog').waitFor({ state: 'visible' })
    assert.equal(await isOpen('settingsPanel'), false, 'the channel picker replaces Settings')
    assert.deepEqual(await page.locator('#searchChannelsDialog label').allTextContents(), [' Anders på landet', ' Ljudbok Klubb'])
    await page.locator('#searchChannelsDialog input[type=search]').fill('Ljudbok')
    assert.equal(await page.locator('#searchChannelsDialog label:visible').count(), 1)
    await page.locator('#searchChannelsDialog input[value="Ljudbok Klubb"]').check()
    await screenshot('cupitor-channel-names')
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await page.waitForFunction(() => {
      const urls = Object.values(window._lastWordToItemsMap || {}).flat().map(item => item.url)
      return urls.includes('testVideo01') && urls.includes('testVideo03') && urls.every(url => url === 'testVideo01' || url === 'testVideo03')
    })
    await click('#toggleSettingsPanelBtn')
    assert.match(await page.locator('#searchChannelsBtn').innerText(), /1 selected/)
    await click('#searchChannelsBtn')
    assert.equal(await page.locator('#searchChannelsDialog input[value="Ljudbok Klubb"]').isChecked(), true)
    await page.locator('#searchChannelsDialog input[value="Ljudbok Klubb"]').uncheck()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.deepEqual(await page.evaluate(() => window._appSettings.searchChannels), ['Ljudbok Klubb'])

    // A newly added dialog must survive its opening click without an ID exception,
    // outside taps, and a handler that removes its own clicked element.
    await page.evaluate(() => {
      $('<button id="fixtureOpen" style="position:fixed;bottom:10px;right:10px;z-index:100010">Open test dialog</button>')
        .appendTo('body').on('click', () => {
          if (!$('#fixtureDialog').length) {
            $('<div id="fixtureDialog"><input aria-label="Draft"><button id="fixtureReplace">Refresh row</button></div>')
              .appendTo('body').on('click', '#fixtureReplace', e => $(e.target).replaceWith('<span>Updated row</span>'))
              .dialog({ title: 'New dialog' })
          } else $('#fixtureDialog').dialog('open')
        })
      $('<button id="fixtureOutside" style="position:fixed;bottom:10px;left:10px;z-index:100010">Outside</button>').appendTo('body')
    })
    await click('#fixtureOpen')
    assert.equal(await isOpen('fixtureDialog'), true, 'opening click must not close a new dialog')
    await page.locator('#fixtureDialog input').fill('Keep this draft')
    await click('#fixtureOutside')
    assert.equal(await isOpen('fixtureDialog'), true, 'outside click must not discard a dialog')
    assert.equal(await page.locator('#fixtureDialog input').inputValue(), 'Keep this draft')
    await click('#fixtureReplace')
    assert.equal(await isOpen('fixtureDialog'), true, 'a detached click target must not close the dialog')
    await page.locator('#fixtureDialog input').press('Escape')
    assert.equal(await isOpen('fixtureDialog'), false)
    await click('#fixtureOpen')
    await page.locator('#fixtureDialog').locator('..').locator('.ui-dialog-titlebar-close').click()
    assert.equal(await isOpen('fixtureDialog'), false)

    // Small popovers still close outside, but an inside click uses the current
    // event target instead of the old document-ready event.
    await page.evaluate(() => {
      if (!$('#subtitleWordPopover').length) $('<div id="subtitleWordPopover"></div>').appendTo('body')
      $('#subtitleWordPopover').removeAttr('hidden').html('<button id="fixturePopoverInside">Inside</button>')
        .css({ position: 'fixed', top: '100px', left: '20px' })
    })
    await click('#fixturePopoverInside')
    assert.equal(await page.locator('#subtitleWordPopover').getAttribute('hidden'), null)
    await click('#fixtureOutside')
    assert.notEqual(await page.locator('#subtitleWordPopover').getAttribute('hidden'), null)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForFunction(() => window._appSettings?.searchChannels?.[0] === 'Ljudbok Klubb')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile touch' : 'Desktop'}: dialog opening, Settings handoff, filtering, cancel, persistence, dismissal and popovers passed`)
  } finally {
    await page.close()
  }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    await checkDialogs(browser, false)
    await checkDialogs(browser, true)
    await require('./practice-controls.cjs').checkPracticeControls(browser)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })

module.exports = { serveFixtures }
