const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

const base = 'https://spraakbanken.gu.se/resurser/data/karp/so-2009-webbversion/'

async function checkLookup(browser, language, mobile = false) {
  const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(10000)
  await page.context().route('https://*.wiktionary.org/**', route =>
    route.fulfill({ contentType: 'text/html', body: '<title>Wiktionary</title>' }))
  await page.route('**/*', route => {
    // Avoid loading the shared fixture's Swedish verb-expansion rules into
    // the Spanish conjugator. The same test word lets us check language gating.
    if (new URL(route.request().url()).pathname.endsWith('/vocabulary.txt')) {
      return route.fulfill({ contentType: 'text/plain', body: '#Weather\n(hail)|hagla|\n' })
    }
    return serveFixtures(route)
  })
  await page.addInitScript(() => {
    window.dontConfirmOnRefresh = true
    window.dictionaryOpenedUrls = []
    window.open = url => { window.dictionaryOpenedUrls.push(url); return { focus() {} } }
  })
  try {
    await page.goto(`http://127.0.0.1:3000/language.html?lang=${language}`, { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    const search = async query => {
      await page.locator('#searchText').fill(query)
      await page.locator('#searchText').press('Tab')
      await page.waitForFunction(query => window._vocabularySearchText?.includes(query) &&
        document.querySelector('#result .l-accordion, #result h3') &&
        !document.querySelector('#result').textContent.includes('Loading…'), query)
    }
    await search('hagla')
    const heading = page.locator('#result .l-accordion').filter({ hasText: /^\s*hagla\b/ }).first()
    await heading.waitFor()
    if (!(await heading.evaluate(el => el.classList.contains('active')))) await heading.click()
    const group = heading.locator('..')
    const soLink = group.locator(`a[href^="${base}"]`)
    assert.equal(await soLink.count(), language === 'swedish' ? 1 : 0)
    if (language === 'swedish') assert.equal(await soLink.getAttribute('href'), base + 'hagla.html')

    const click = locator => mobile ? locator.tap() : locator.click()
    const popup = page.locator('#subtitleWordPopover')
    const assertShortcut = async (link, expectedUrl) => {
      assert.equal(await link.getAttribute('href'), expectedUrl)
      const [tab] = await Promise.all([page.waitForEvent('popup'), click(link)])
      try {
        await tab.waitForURL(expectedUrl)
        assert.equal(await popup.isVisible(), false)
      } finally { await tab.close() }
    }
    const wiktionary = `https://${language === 'swedish' ? 'sv' : 'es'}.wiktionary.org`
    await assertShortcut(group.getByRole('link', { name: 'hagla', exact: true }), `${wiktionary}/wiki/hagla`)

    const wiki = group.locator('.srt-file span.link[data-lookup-word="hagla"]').first()
    await click(wiki)
    await popup.waitFor({ state: 'visible' })
    const assertOutsideWord = async () => {
      const wordBox = await wiki.boundingBox(), popupBox = await popup.boundingBox()
      assert.ok(popupBox.y >= wordBox.y + wordBox.height + 10 ||
        popupBox.y + popupBox.height <= wordBox.y - 10,
      'dictionary actions stay outside the word and its touch target')
    }
    await assertOutsideWord()
    assert.equal(await popup.locator('[data-action="search-so"]').isVisible(), language === 'swedish')
    await click(popup.locator('[data-action="search-wiki"]'))
    assert.match((await page.evaluate(() => window.dictionaryOpenedUrls)).at(-1), /wiktionary\.org\/wiki\/hagla$/)

    if (language === 'swedish') {
      await click(wiki)
      await click(popup.locator('[data-action="search-so"]'))
      assert.equal((await page.evaluate(() => window.dictionaryOpenedUrls)).at(-1), base + 'hagla.html')
      // Popup reuse must hide SO for an English line, then restore it for SV.
      const searchToken = await page.evaluate(() => window._subtitleSearchToken)
      await wiki.evaluate(el => el.parentElement.setAttribute('data-lang-code', 'en'))
      await wiki.evaluate(el => el.parentElement.classList.add('line'))
      await click(wiki)
      assert.equal(await popup.locator('[data-action="search-so"]').isVisible(), false)
      await assertOutsideWord()
      await wiki.evaluate(el => el.parentElement.setAttribute('data-lang-code', 'sv'))
      await click(wiki)
      assert.equal(await popup.locator('[data-action="search-so"]').isVisible(), true)
      await assertOutsideWord()
      assert.equal(await page.evaluate(() => window._subtitleSearchToken), searchToken,
        'reopening the dictionary popup must not activate Search here')
      await page.locator('#searchText').click()
    }

    // A term without subtitle matches still has both dictionary lookups.
    await search('sköta sig')
    await page.locator('#result .l-accordion, #result h3').first().waitFor()
    const fallback = page.locator(`#result a[href^="${base}"]`)
    assert.equal(await fallback.count(), language === 'swedish' ? 1 : 0)
    if (language === 'swedish') assert.equal(await fallback.getAttribute('href'), base + 'sk%C3%B6ta%20sig.html')
    const phraseHeading = page.locator('#result .l-accordion').filter({ hasText: /^\s*sköta sig\s*$/ })
    if (await phraseHeading.count() && !(await phraseHeading.evaluate(el => el.classList.contains('active')))) {
      await click(phraseHeading)
    }
    await assertShortcut(page.locator('#result').getByRole('link', { name: 'sköta sig', exact: true }),
      `${wiktionary}/w/index.php?search=sk%C3%B6ta+sig`)
    assert.deepEqual(errors, [])
    console.log(`${language}${mobile ? ' mobile' : ''}: dictionary links, word popup, language gating and no-match fallback passed`)
  } catch (error) {
    console.error(await page.evaluate(() => ({ search: window.searchText, result: document.querySelector('#result').textContent })), errors)
    throw error
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined })
  try {
    await checkLookup(browser, 'swedish')
    await checkLookup(browser, 'swedish', true)
    await checkLookup(browser, 'spanish')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
