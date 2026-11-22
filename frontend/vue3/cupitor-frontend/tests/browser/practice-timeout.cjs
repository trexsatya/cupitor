const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

async function check(browser, mobile, minimized) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 844 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.evaluate(() => {
      window._appSettings.studySessionTimeoutMinutes = 1
      window._appSettings.recPlayShuffle = false
      window.__timeoutSpeaks = 0
      Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        speak() { window.__timeoutSpeaks++ }, cancel() {}, getVoices() { return [] },
      } })
      window.__timeoutCards = [
        { manual: true, id: 'timeout-one', source: 'hej', target: 'hello' },
        { manual: true, id: 'timeout-two', source: 'tack', target: 'thanks' },
      ]
      window.openPracticeMode({ queue: window.__timeoutCards, temporary: true })
    })
    await page.locator('#practiceMode').waitFor({ state: 'visible' })
    if (minimized) await page.locator('#practiceMode .practice-minimize').click()
    await page.evaluate(() => {
      const original = Date.now
      const afterDeadline = original() + 61000
      Date.now = () => afterDeadline
      try { window.dispatchEvent(new CustomEvent('cupitorAppLifecycle', { detail: { isForeground: true } })) }
      finally { Date.now = original }
    })
    const popup = page.getByRole('alertdialog', { name: 'Practice session timed out' })
    await popup.waitFor({ state: 'visible' })
    assert.equal(await popup.evaluate(dialog => dialog.matches(':modal')), true)
    await page.keyboard.press('Escape')
    await popup.evaluate(dialog => { dialog.tabIndex = -1; dialog.focus() })
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Space')
    await page.mouse.click(4, 4)
    assert.equal(await popup.isVisible(), true)
    await page.evaluate(() => {
      // Direct/native commands cannot bypass the modal's inert backdrop.
      window.jQuery('#practiceMode .practice-next').trigger('click')
      window.jQuery('#practiceMode .practice-reveal').trigger('click')
      window.jQuery('#practiceMode .practice-play').trigger('click')
      window.openPracticeMode({ queue: window.__timeoutCards.slice(1) })
      window.dispatchEvent(new CustomEvent('cupitorMediaKey', { detail: { key: 'play_pause' } }))
    })
    assert.equal(await page.evaluate(() => window._practiceIdx), 0)
    assert.equal(await page.evaluate(() => window.__timeoutSpeaks), 0)
    await popup.getByRole('button', { name: 'Close', exact: true }).focus()
    await page.keyboard.press('Enter')
    await popup.waitFor({ state: 'detached' })
    assert.equal(await page.evaluate(() => window.__timeoutSpeaks), 0, 'dismissing never auto-resumes sound')
    assert.equal(await page.evaluate(() => window._practiceMinimized), minimized)
    if (!minimized) {
      await page.evaluate(() => document.activeElement?.blur())
      await page.keyboard.press('ArrowRight')
      assert.equal(await page.evaluate(() => window._practiceIdx), 1)
    }
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'} ${minimized ? 'minimized' : 'visible'} Practice timeout requires manual dismissal`)
  } finally { await page.close() }
}

;(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'] })
  try { for (const mobile of [false, true]) for (const minimized of [false, true]) await check(browser, mobile, minimized) }
  finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
