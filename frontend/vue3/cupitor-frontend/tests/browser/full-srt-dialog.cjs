const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

const first = 'fullSrt0001', second = 'fullSrt0002'
const time = seconds => new Date(seconds * 1000).toISOString().slice(11, 23).replace('.', ',')
const source = Array.from({ length: 260 }, (_, i) => `${i + 1}\n${time(i * 2)} --> ${time(i * 2 + 2)}\n` +
  (i === 129 ? 'En färgsprakande kväll.' : `Svensk rad ${i + 1}.`) +
  (i === 259 ? '\n<em id="srt-markup">Literal subtitle markup</em>' : '') + '\n').join('\n')
const english = '1\n00:00:00,000 --> 00:00:02,000\nEnglish first cue.\n\n260\n00:08:38,000 --> 00:08:40,000\nEnglish final cue.\n'
const other = '1\n00:00:10,000 --> 00:00:12,000\nEn annan färgsprakande scen.\n\n2\n00:00:12,000 --> 00:00:14,000\nSecond link, final cue.\n'

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: mobile ? { width: 393, height: 780 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(10000)
  let defer = false, fail = false, release
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), file = decodeURIComponent(url.pathname)
    if (url.hostname !== '127.0.0.1') {
      if (file.endsWith('/srts/index.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify([
        { link: first, name: `Test || Long subtitles || ${first}`, source: 'YouTube' },
        { link: second, name: `Test || Source only || ${second}`, source: 'YouTube' },
      ]) })
      if (file.endsWith('.srt')) {
        if (file.includes(first) && !file.endsWith('.en.srt')) {
          if (defer) { defer = false; await new Promise(resolve => { release = resolve }) }
          if (fail) return route.fulfill({ status: 503, body: 'Unavailable' })
        }
        if (file.includes(second) && file.endsWith('.en.srt')) return route.fulfill({ status: 404, body: 'Not found' })
        return route.fulfill({ contentType: 'text/plain', body: file.includes(second) ? other : file.endsWith('.en.srt') ? english : source })
      }
    }
    return serveFixtures(route)
  })
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const click = locator => mobile ? locator.tap() : locator.click()
  const dialog = page.locator('#fullSrtDialog')
  const pre = dialog.locator('.full-srt-text')
  const open = async link => {
    await click(page.locator(`#result .play-btn-container[data-url="${link}"] .media-info`).first())
    await click(page.locator('#info-dialog-content').getByRole('button', { name: 'Show complete SRT' }))
    await dialog.waitFor({ state: 'visible' })
  }
  const close = async () => {
    await click(dialog.locator('..').locator('.ui-dialog-buttonpane').getByRole('button', { name: 'Close', exact: true }))
    await page.evaluate(() => $('#info-dialog-content').dialog('close'))
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    // Desktop can replace the info action with a direct media link. Exercise
    // the info-panel setting on both devices for this panel-specific feature.
    await page.evaluate(() => { window.showInfoWithoutPopup = false })
    await page.locator('#searchText').fill('färgsprakande')
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(() => document.querySelectorAll('#result .srt-file').length === 2 &&
      !document.getElementById('result').textContent.includes('Loading…'))
    assert(await page.locator('#result .main-line').count() < 20, 'search only shows matching excerpts')
    await open(first)
    await pre.waitFor({ state: 'visible' })
    assert.equal(await pre.textContent(), source, 'all 260 original cues, times and markup remain intact')
    assert.equal(await page.locator('#srt-markup').count(), 0, 'subtitle markup is displayed as text')
    assert.equal(await dialog.locator('.full-srt-language option').count(), 2)
    const bounds = await dialog.locator('..').boundingBox()
    assert(bounds.y >= 0 && bounds.y + bounds.height <= (mobile ? 780 : 900) + 1, 'dialog fits the viewport')
    if (mobile) {
      const cdp = await page.context().newCDPSession(page)
      const box = await dialog.boundingBox(), x = box.x + box.width * .6, y = box.y + box.height * .8
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 35 }] })
        await page.waitForTimeout(20)
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
    } else {
      await pre.hover()
      await page.mouse.wheel(0, 500)
    }
    await page.waitForFunction(() => document.getElementById('fullSrtDialog').scrollTop > 0)
    await dialog.locator('.full-srt-language').selectOption('en')
    assert.equal(await pre.textContent(), english, 'English file is independently complete')
    await page.waitForFunction(() => document.getElementById('fullSrtDialog').scrollTop === 0)
    await close()
    await open(second)
    await pre.waitFor({ state: 'visible' })
    assert.equal(await pre.textContent(), other, 'another result opens its own subtitle file')
    assert.equal(await dialog.locator('.full-srt-language option').count(), 1, 'missing translation is omitted')
    await close()

    // An excerpt-only capture must fetch the full indexed file. Closing and
    // opening a different result while that fetch runs must keep the new file.
    await page.evaluate(first => { window.allSubtitles[first]._partial = true; window.allSubtitles[first].sv = 'Captured excerpt only' }, first)
    defer = true
    await open(first)
    await page.waitForFunction(() => document.getElementById('fullSrtDialog').getAttribute('aria-busy') === 'true')
    await close()
    await open(second)
    await pre.waitFor({ state: 'visible' })
    assert(release, 'full file fetch is pending')
    release()
    await page.waitForFunction(first => !window.allSubtitles[first]._partial, first)
    assert.equal(await pre.textContent(), other, 'late response cannot replace a different link')
    await close()

    await page.evaluate(first => { window.allSubtitles[first]._partial = true }, first)
    fail = true
    await open(first)
    await dialog.getByRole('button', { name: 'Try again' }).waitFor({ state: 'visible' })
    assert.equal(await pre.isVisible(), false, 'a failed fetch does not pass off excerpts as a full SRT')
    fail = false
    await click(dialog.getByRole('button', { name: 'Try again' }))
    await pre.waitFor({ state: 'visible' })
    assert.equal(await pre.textContent(), source, 'retry recovers the complete file')
    await close()
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: Full SRT action, complete files, languages, scrolling, safe text, late responses and retry passed`)
  } finally {
    if (release) release()
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
