// Vocabulary rows from the reported rännsten screenshot. No live network.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const rows = require('./fixtures/compound-vocabulary.json')
const categories = new Map()
for (const row of rows) {
  if (!categories.has(row.category)) categories.set(row.category, [])
  categories.get(row.category).push(row.line)
}
const vocabulary = [...categories].map(([category, lines]) => '#' + category + '\n' + lines.join('\n')).join('\n')
const cues = '1\n00:00:01,000 --> 00:00:03,000\nBilen stannade vid en rännsten. Här finns flera rännstenar.\n\n2\n00:00:03,000 --> 00:00:05,000\nVatten leds genom en stenränna.\n'

async function fixtures(route) {
  const url = new URL(route.request().url()), file = decodeURIComponent(url.pathname)
  if (url.hostname !== '127.0.0.1') {
    if (file.endsWith('/vocabulary.txt')) return route.fulfill({ contentType: 'text/plain', body: vocabulary })
    if (file.endsWith('.srt')) return route.fulfill({ contentType: 'text/plain', body: cues })
  }
  return serveFixtures(route)
}

async function checkGroups(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', fixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => { await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]) })
    const search = async query => {
      await page.locator('#searchText').fill(query)
      await page.locator('#searchText').press('Tab')
      await page.waitForFunction(query => String(window._librarySearchText || '').toLowerCase() === query.toLowerCase() &&
        !document.getElementById('result').textContent.includes('Loading…') &&
        document.querySelectorAll('#vocabularyResult .vocabulary-segment').length >= 12, query)
    }
    for (const autoPrefix of [false, true]) {
      await page.evaluate(auto => {
        $('#toggleAutoPrefixSearchCheckbox').prop('checked', auto)
        window._appSettings.autoPrefixSearch = auto
        $('#numberOfPrefixFindings').val('1')
      }, autoPrefix)
      for (const query of ['RÄNNSTEN', 'stenränna', 'rännstenar']) {
        await search(query)
        const groups = page.locator('#vocabularyResult [data-vocab-group-kind="compound"]')
        assert.deepEqual(await groups.locator(':scope > .prefix-group-header .prefix-group-part').allTextContents(), ['ränna', 'sten'])
        assert.equal(await page.locator('#vocabularyResult > .vocabulary-segment[data-vocab-match-kind="compound"]').count(), 0, 'component findings are not flat rows')
        for (const part of ['ränna', 'sten']) {
          const group = groups.filter({ has: page.locator('.prefix-group-part', { hasText: new RegExp('^' + part + '$') }) })
          const expected = rows.filter(row => row.part === part).map(row => row.line)
          assert.equal(await group.locator('.prefix-group-count').innerText(), '(' + expected.length + ')')
          const actual = await group.locator('.similar-segment-header').evaluateAll(els => els.map(el => $(el).data('text')))
          assert.deepEqual(actual, expected, 'every original finding stays under its matching word')
          assert.equal(await group.locator('.similar-segment-header:visible').count(), 0, 'groups start collapsed')
          const header = group.locator(':scope > .prefix-group-header')
          if (mobile) await header.tap(); else await header.click()
          assert.equal(await group.locator('.similar-segment-header:visible').count(), expected.length, 'all component findings remain available despite the prefix limit of one')
          await group.locator('.similar-segment-header').first().click()
          assert.equal(await group.locator('.similar-segment-body:visible').count(), 1, 'individual vocabulary context still opens')
          if (mobile) await header.tap(); else await header.click()
          assert.equal(await group.locator('.similar-segment-header:visible').count(), 0)
        }
      }
    }
    // A direct exact compound remains outside its component groups.
    await page.evaluate(() => {
      window.vocabulary.ExactCompound = ['(gutter)|rännsten|']
      window.searchText = 'rännsten'
      window.renderVocabularyFindings('rännsten')
    })
    assert.equal(await page.locator('#vocabularyResult > .vocabulary-segment[data-vocab-match-kind="exact"]').count(), 1)
    assert.equal(await page.locator('#vocabularyResult .compound-group').count(), 2)
    // Searching a component itself keeps its normal direct findings.
    await page.evaluate(() => { window.searchText = 'sten'; window.renderVocabularyFindings('sten') })
    assert.equal(await page.locator('#vocabularyResult .compound-group').count(), 0)
    assert.equal(await page.locator('#vocabularyResult > .vocabulary-segment').count(), 9)
    await page.evaluate(() => { delete window.vocabulary.ExactCompound; window.searchText = 'rännsten'; window.renderVocabularyFindings('rännsten') })
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await page.locator('#vocabularyResult').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'compound-groups-' + (mobile ? 'mobile' : 'desktop') + '.png') })
    }
    // Competing root fragments must not consume a real component and send it
    // into the capped prefix suggestions. These are the reported vocabulary
    // rows, including the misleading shorter split and an unrelated ending.
    await page.evaluate(() => {
      window.vocabulary = { Words: [
        '(threshold)|tröskel|trösklar|', '(host)|värd|', '(value)|Sätta värde på något|',
        '(learning)|Lärdom är mer värt än guld|', '(strabismus, squint)|strabism|skelning|skelningar|',
        '(run out, end)|tryta|tryter|tröt|truttit|tryt|', '(thresh)|tröska|',
        '(crackle)|spraka|', '(color)|färg|', '(spirit)|ande|',
      ] }
      $('#numberOfPrefixFindings').val('1')
      window._appSettings.prefixResultsMax = 1
    })
    const componentLabels = () => page.locator('#vocabularyResult .compound-group > .prefix-group-header .prefix-group-part').allTextContents()
    for (const autoPrefix of [false, true]) {
      await page.evaluate(auto => {
        $('#toggleAutoPrefixSearchCheckbox').prop('checked', auto)
        window._appSettings.autoPrefixSearch = auto
      }, autoPrefix)
      for (const query of ['tröskelvärde', 'tröskelvärden']) {
        await page.locator('#searchText').fill(query)
        await page.locator('#searchText').press('Tab')
        await page.waitForFunction(({query, autoPrefix}) => String(window._librarySearchText || '').split('|')[0] === query &&
          !document.getElementById('result').textContent.includes('Loading…') &&
          document.querySelectorAll('#vocabularyResult .compound-group').length === 2 &&
          document.querySelectorAll('#vocabularyResult [data-vocab-group-kind="prefix"]').length === (autoPrefix ? 1 : 0), {query, autoPrefix})
        assert.deepEqual(await componentLabels(), ['tröskel', 'värd'])
        assert.equal(await page.locator('#vocabularyResult .compound-group .similar-segment-header').filter({ hasText: /skelning|tröt/ }).count(), 0)
        const kinds = await page.locator('#vocabularyResult > .prefix-group').evaluateAll(els => els.map(el => el.dataset.vocabGroupKind))
        assert.deepEqual(kinds, autoPrefix ? ['compound', 'compound', 'prefix'] : ['compound', 'compound'])
        if (autoPrefix) assert.equal(await page.locator('#vocabularyResult .prefix-group[data-vocab-group-kind="prefix"] .vocabulary-segment').count(), 1)
      }
    }
    // The explicit prefix-search action uses the same classification.
    assert(await page.evaluate(() => window.searchText.includes('|')), 'exercise the subtitle stem-fallback path before changing modes')
    await page.evaluate(() => {
      $('#toggleAutoPrefixSearchCheckbox').prop('checked', false)
      window.renderVocabularyFindings(window._vocabularySearchText)
    })
    await page.locator('#searchVocabularyByPrefixBtn').click()
    await page.locator('#searchVocabularyMenu [data-mode="prefix"]').click()
    assert.deepEqual(await componentLabels(), ['tröskel', 'värd'])
    assert.equal(await page.locator('#vocabularyResult [data-vocab-group-kind="prefix"]').count(), 1)
    // Changing the setting redraws the same query, not the subtitle fallback.
    await page.evaluate(() => $('#toggleAutoPrefixSearchCheckbox').prop('checked', true).trigger('change'))
    assert.deepEqual(await componentLabels(), ['tröskel', 'värd'])
    assert.equal(await page.locator('#vocabularyResult [data-vocab-group-kind="prefix"]').count(), 1)
    if (process.env.SCREENSHOT_DIR) {
      await page.locator('#vocabularyResult').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'primary-components-' + (mobile ? 'mobile' : 'desktop') + '.png') })
    }
    await page.evaluate(() => { window.searchText = 'färgsprakande'; window.renderVocabularyFindings('färgsprakande') })
    assert.deepEqual(await componentLabels(), ['färg', 'spraka'])
    assert.equal(await page.locator('#vocabularyResult .compound-group .similar-segment-header').filter({ hasText: /\|ande\|/ }).count(), 0)
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} compound groups passed: ordinary/manual/automatic prefix search, competing splits, complete components, inflections, exact hits and expansion`)
  } catch (error) {
    console.error(await page.evaluate(() => ({query: $('#searchText').val(), search: window.searchText,
      library: window._librarySearchText, autoPrefix: $('#toggleAutoPrefixSearchCheckbox').is(':checked'),
      prefixMax: window._appSettings.prefixResultsMax,
      groups: [...document.querySelectorAll('#vocabularyResult > .prefix-group')].map(el => ({kind: el.dataset.vocabGroupKind, label: el.querySelector('.prefix-group-part')?.textContent})),
      loading: document.getElementById('result').textContent.includes('Loading…')})))
    throw error
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await checkGroups(browser, false)
    if (!process.argv.includes('--desktop-only')) await checkGroups(browser, true)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
