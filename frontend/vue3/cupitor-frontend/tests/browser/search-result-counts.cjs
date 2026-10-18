// Browser-level regression for a broad search reporting no results for a word
// that has matches when searched directly, and for regex highlighting in the
// surrounding subtitle context. Uses only local fixture data.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')

const index = [{ link: 'testVideo01', name: 'Test channel || Shared subtitle matches || testVideo01', source: 'YouTube' }]
// Both words genuinely occur in every cue. Repeating one in a cue also checks
// that preserving results per word does not duplicate a card within a group.
const cues = Array.from({ length: 13 }, (_, i) =>
  `${i + 1}\n00:00:${String(i * 2 + 1).padStart(2, '0')},000 --> 00:00:${String(i * 2 + 3).padStart(2, '0')},000\nVi måste förhålla oss till förutsättningarna och förhålla oss lugna.\n`).join('\n') + `
14
00:00:27,000 --> 00:00:29,000
"Hellre för många dåliga konstnärer än för få bra."

15
00:00:29,000 --> 00:00:31,000
Men utan att förringa en viktig diskussion om politisk styrning av kultur och konst –

16
00:00:31,000 --> 00:00:33,000
– ter det sig ändå i dagsläget kanske som en västanfläkt –
`

async function fixtures(route) {
  const url = new URL(route.request().url())
  const file = decodeURIComponent(url.pathname)
  if (url.hostname !== '127.0.0.1') {
    if (file.endsWith('/srts/index.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(index) })
    if (file.endsWith('.srt')) return route.fulfill({ contentType: 'text/plain', body: cues })
    if (file.endsWith('/vocabulary.txt')) return route.fulfill({ contentType: 'text/plain',
      body: '#Conduct\n(relate)|förhålla|\n#Conditions\n(conditions)|förutsättningarna|\n' })
  }
  return serveFixtures(route)
}

async function checkCounts(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(10000)
  await page.route('**/*', fixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.evaluate(() => { $('#numberOfFindingsToShow').val('2'); window._appSettings.autoPrefixSearch = false })
    const search = async query => {
      await page.locator('#searchText').fill(query)
      await page.locator('#searchText').press('Tab')
      await page.waitForFunction(query => window._librarySearchText === query.toLowerCase() &&
        document.querySelector('#result .l-accordion') &&
        !document.querySelector('#result').textContent.includes('Loading…') &&
        document.querySelector('#result .l-accordion').hasAttribute('accordion-rendered'), query)
    }
    const group = word => page.locator('#result .l-accordion').filter({ hasText: new RegExp('^\\s*' + word + '\\s*(?:\\(\\d+\\))?\\s*$') })
    const checkWord = async word => {
      const header = group(word)
      assert.equal(await header.count(), 1, 'one result heading for ' + word)
      assert.equal(await header.locator('.match-count').innerText(), '(13)', word + ' keeps all thirteen matching cues')
      assert.equal(await header.evaluate(el => el.classList.contains('no-result')), false, word + ' must not be greyed out')
      assert.equal(await header.locator('..').locator('.srt-file').count(), 2, 'render limit still applies without duplicate cards')
    }
    await search('förhålla')
    await checkWord('förhålla')
    await search('förutsättningarna')
    await checkWord('förutsättningarna')
    await search('För.*')
    await checkWord('förhålla')
    await checkWord('förutsättningarna')
    // Actual header interaction must expose useful cards under either word.
    for (const word of ['förhålla', 'förutsättningarna']) {
      const header = group(word)
      if (!(await header.evaluate(el => el.classList.contains('active')))) {
        if (mobile) await header.tap()
        else await header.click()
      }
      await header.locator('..').locator('.srt-file').first().waitFor({ state: 'visible' })
    }
    await search('förhålla|förutsättningarna')
    await checkWord('förhålla')
    await checkWord('förutsättningarna')
    // A space inside [^ ] is part of the regex. It must not turn the
    // neighbouring "för många ... för få" quote into one long highlight.
    await page.evaluate(() => {
      window._appSettings.contextLinesBefore = 1
      window._appSettings.contextLinesAfter = 1
    })
    await search('för[^ ]+')
    const header = group('förringa')
    if (!(await header.evaluate(el => el.classList.contains('active')))) {
      if (mobile) await header.tap()
      else await header.click()
    }
    const panel = header.locator('..')
    const quote = panel.locator('.main-line[data-line-index="14"]')
    await quote.waitFor({ state: 'visible' })
    assert.match(await quote.innerText(), /Hellre för många dåliga konstnärer än för få bra/)
    assert.equal(await quote.locator('.highlight').count(), 0, 'unmatched context text stays unhighlighted')
    const highlighted = await panel.locator('.main-line[data-line-index="15"] .highlight').allTextContents()
    assert.deepEqual(highlighted.map(text => text.trim()), ['förringa'])
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await panel.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `search-result-counts-${mobile ? 'mobile' : 'desktop'}.png`) })
    }
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: direct/regex/alternative result counts and character-class highlighting passed`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await checkCounts(browser, false)
    if (!process.argv.includes('--desktop-only')) await checkCounts(browser, true)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
