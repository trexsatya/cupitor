const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const saved = require('./fixtures/recorded-playlists.json')
const name = 'Taare Zameen Par - 2'

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  page.setDefaultTimeout(10000)
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
  const click = async selector => {
    if (await page.evaluate(() => document.body.classList.contains('study-controls-hidden'))) await touchCard(false)
    if (mobile) await page.locator(selector).tap(); else await page.locator(selector).click()
  }
  const touchCard = async (swipe) => {
    const r = await page.locator('#practiceMode .practice-card').boundingBox()
    const x = r.x + r.width * 0.8, y = r.y + r.height - 30
    if (mobile) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      if (!swipe) assert.equal(await page.locator('#practiceMode.panel-open').count(), 0, 'touch-down dismisses before the compatibility click')
      if (swipe) for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x: x - r.width * 0.6 * i / 8, y }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach()
    } else {
      await page.mouse.move(x, y); await page.mouse.down()
      if (!swipe) assert.equal(await page.locator('#practiceMode.panel-open').count(), 0, 'mouse-down dismisses immediately')
      if (swipe) await page.mouse.move(x - r.width * 0.6, y, { steps: 8 })
      await page.mouse.up()
    }
  }
  const closed = async () => {
    for (const button of ['info', 'settings']) {
      assert.equal(await page.locator('#practiceMode .practice-' + button + '-panel').isVisible(), false)
      assert.equal(await page.locator('#practiceMode .practice-' + button).getAttribute('aria-expanded'), 'false')
      assert.equal(await page.locator('#practiceMode .practice-' + button + '.active').count(), 0)
    }
    assert.equal(await page.locator('#practiceMode.panel-open').count(), 0)
  }
  const onTop = async panel => {
    assert.equal(await page.locator(panel).evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(33, 33, 33)', 'panel background is fully opaque')
    assert(await page.evaluate(() => +getComputedStyle(document.querySelector('#practiceMode')).zIndex >
      +getComputedStyle(document.querySelector('#studyMediaDivider')).zIndex), 'panel container clears the sibling divider')
    const p = await page.locator(panel).boundingBox(), d = await page.locator('#studyMediaDivider').boundingBox()
    const overlaps = d.y + d.height / 2 > p.y && d.y + d.height / 2 < p.y + p.height
    const x = p.x + p.width * 0.5, y = overlaps ? d.y + d.height / 2 : p.y + p.height / 2
    assert(await page.evaluate(({ panel, x, y }) => !!document.elementFromPoint(x, y)?.closest(panel), { panel, x, y }), 'panel receives input over the card/video/divider')
    return overlaps
  }
  const screenshot = async suffix => {
    if (!mobile || !process.env.SCREENSHOT_DIR) return
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'practice-' + suffix + '.png') })
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.evaluate(({ rec, name }) => {
      const s = window.__yt = { id: '', time: 0, state: 2, muted: false }
      window.ytPlayer = {
        mute: () => { s.muted = true }, unMute: () => { s.muted = false }, isMuted: () => s.muted,
        pauseVideo: () => { s.state = 2 }, playVideo: () => { s.state = 1 },
        cueVideoById: v => { s.id = v.videoId; s.time = v.startSeconds || 0; s.state = 5 },
        loadVideoById: v => { s.id = v.videoId; s.time = v.startSeconds || 0; s.state = 1 },
        seekTo: t => { s.time = t }, getCurrentTime: () => s.time, getPlayerState: () => s.state,
        getVideoData: () => ({ video_id: s.id }), getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
        getIframe: () => document.getElementById('youtubePlayer'), getDuration: () => 12000,
        getAvailablePlaybackRates: () => [0.5, 0.75, 1], getPlaybackRate: () => 1, setPlaybackRate: () => {}, addEventListener: () => {}
      }
      window.ytPlayerReady = true
      Object.assign(window._appSettings, { recPlayShuffle: false, practiceRevealMode: 'flip',
        practiceFrontIsSource: true, practiceSpeedOptions: [1, 0.75, 0.5], studySplit_practice: 0.12 })
      window._recordings[name] = rec
      const queue = rec.items.Manual.Card.map((it, i) => ({ ...it, _recName: name, _st: 'Manual', _w: 'Card', _idx: i }))
      window.openPracticeMode({ resumeQueue: { queue, pos: 9 }, single: true })
    }, { rec: saved.playlists[name], name })
    await page.waitForFunction(() => window.__yt.state === 5 && !document.querySelector('#studyMediaDivider').hidden)
    await click('#practiceMode .practice-settings')
    assert(await onTop('#practiceMode .practice-settings-panel'), 'settings intersect the divider in the regression layout')
    await page.locator('#practiceMode .practice-speeds-input').fill('1, 0.75, 0.5')
    await click('#practiceMode .practice-speeds-save')
    assert.equal(await page.locator('#practiceMode .practice-settings-panel').isVisible(), true, 'panel controls do not dismiss it')
    await screenshot('settings-opaque')
    await touchCard(false)
    await closed()
    assert.equal(await page.evaluate(() => window._practiceIdx), 9)
    assert.equal(await page.evaluate(() => !!window._practiceFlipped), false)

    await click('#practiceMode .practice-info')
    await onTop('#practiceMode .practice-info-panel')
    assert.match(await page.locator('.practice-info-meta').innerText(), /YouTube · 00:47:06$/)
    assert.match(await page.locator('.practice-info-head').innerText(), /#10 of 100/)
    await screenshot('info-time')
    await touchCard(false)
    await closed()

    await click('#practiceMode .practice-info')
    await click('#practiceMode .practice-settings')
    assert.equal(await page.locator('.practice-info-panel').isVisible(), false, 'panels remain mutually exclusive')
    await touchCard(false)
    await closed()
    const r = await page.locator('#practiceMode .practice-card').boundingBox()
    // Desktop double-click must select text rather than flip the card.
    // Touch double-tap still uses the separate mobile gesture handler.
    if (!mobile) {
      await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height - 30)
      assert.equal(await page.evaluate(() => window._practiceFlipped), false,
        'desktop mouse double-click must not flip the selectable card')
    }

    // Captured clips display a full range, including the hour boundary.
    await page.evaluate(() => {
      window.openPracticeMode({ single: true, queue: [{ id: 'testVideo01', source: 'YouTube',
        word: 'färgsprakande', timeStart: 3599.9, timeEnd: 3723.8, lineIndex: 1 },
        { id: 'testVideo02', source: 'YouTube', word: 'hagla', timeStart: 3, timeEnd: 5, lineIndex: 2 }] })
    })
    await page.waitForFunction(() => $('#practiceMode').data('item')?.id === 'testVideo01' &&
      !document.querySelector('#practiceMode .practice-loading') && window.__yt.id === 'testVideo01')
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await click('#practiceMode .practice-info')
    await page.waitForFunction(() => document.querySelector('.practice-info-meta')?.textContent === 'testVideo01 · YouTube · 00:59:59 – 01:02:03')
    await touchCard(false)
    await closed()
    // A normal DOM click also dismisses (keyboard/assistive activation).
    await click('#practiceMode .practice-settings')
    await page.locator('#practiceMode .practice-card').evaluate(el => el.click())
    await closed()
    await click('#practiceMode .practice-settings')
    await touchCard(true)
    if (!mobile) {
      assert.equal(await page.evaluate(() => window._practiceIdx), 0,
        'desktop mouse drag must select text, not swipe to the next card')
      await page.evaluate(() => {
        getSelection()?.removeAllRanges()
        document.activeElement?.blur()
      })
      await page.keyboard.press('ArrowRight')
    }
    await page.waitForFunction(() => window._practiceIdx === 1)
    await closed()
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: opaque panels above divider, immediate card dismissal, panel actions, touch swipes, desktop text selection and hh:mm:ss details passed`)
  } catch (e) {
    console.error(await page.evaluate(() => ({ body: document.body.className,
      panels: [...document.querySelectorAll('.practice-info-panel,.practice-settings-panel')].map(el => ({ cls: el.className, display: getComputedStyle(el).display, text: el.textContent })),
      infoButton: document.querySelector('.practice-info')?.outerHTML,
      index: window._practiceIdx, card: window._practiceCards?.[window._practiceIdx] })))
    throw e
  } finally { await page.close() }
}
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await check(browser, false)
    if (!process.argv.includes('--desktop-only')) await check(browser, true)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
