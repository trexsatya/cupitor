const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const click = selector => page.locator(selector).click()
  const close = id => page.evaluate(id => $('#' + id).dialog('close'), id)
  const placement = () => page.locator('#manualEntryEditor .card-placement')
  const screenshot = async name => {
    if (!process.env.SCREENSHOT_DIR) return
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${name}-${mobile ? 'mobile' : 'desktop'}.png`) })
  }
  const ordered = () => page.locator('#recordingReviewDialog .rec-item-text').allTextContents()
  const openEditor = async () => {
    await page.evaluate(() => window._openManualEntryEditor(window._recording.currentName, null))
    await page.locator('#meeSource').fill('Inserted card')
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window._recordings = {
        First: { items: { Manual: { Card: [{ id: 'a', manual: true, source: 'First card', enabled: true }] },
          Captured: { word: [{ id: 'testVideo01', source: 'YouTube', timeStart: 1, timeEnd: 3, lineIndex: 1, enabled: true }] } } },
        Second: { items: { Manual: { Card: [{ id: 'b', manual: true, source: 'Second card', enabled: false }] } } },
        Locked: { readOnly: true, items: {} }, Book: { external: true, items: {} },
        Combined: { virtual: true, members: ['First', 'Second'] }
      }
      window._appSettings.cardPlaylist = ''
      window._appSettings.captionPlaylist = ''
      window.selectRecording('First')
      window.openRecordingReviewDialog()
    })
    await click('#recRecAddManual')
    assert.equal(await placement().locator('select').inputValue(), 'First')
    assert.deepEqual(await placement().locator('select option').allTextContents(), ['First', 'Second'])
    await page.locator('#meeSource').fill('Inserted card')
    await placement().locator('input').fill('0')
    assert.equal(await page.locator('#manualEntryEditor').locator('..').getByRole('button', { name: 'Add', exact: true }).isDisabled(), true)
    await placement().locator('input').fill('2')
    assert.match(await placement().locator('.card-placement-preview').innerText(), /#1[\s\S]*First card[\s\S]*#2[\s\S]*New card[\s\S]*#3/)
    await screenshot('insertion')
    await page.locator('#manualEntryEditor').locator('..').getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('#manualEntryEditor').waitFor({ state: 'hidden' })
    assert.match((await ordered())[1], /Inserted card/)
    assert.match((await ordered())[2], /testVideo01/)
    // A successful destination wins over whichever playlist is being viewed.
    await openEditor()
    await placement().locator('select').selectOption('Second')
    await page.locator('#manualEntryEditor').locator('..').getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('#manualEntryEditor').waitFor({ state: 'hidden' })
    await page.evaluate(() => window.selectRecording('First'))
    await openEditor()
    assert.equal(await placement().locator('select').inputValue(), 'Second')
    await placement().locator('select').selectOption('First')
    await close('manualEntryEditor')
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(async () => { await window._vocabularyReadyPromise })
    await openEditor()
    assert.equal(await placement().locator('select').inputValue(), 'Second', 'cancel does not replace the successful destination; reload retains it')
    assert.equal(await placement().locator('input').inputValue(), '', 'index is not reused')
    await close('manualEntryEditor')
    await page.evaluate(() => { window.selectRecording('First'); window.openRecordingReviewDialog() })
    assert.match((await ordered())[1], /Inserted card/, 'global order survives reload')
    await page.locator('.rec-copy-to').first().click()
    const copy = page.locator('#cardDestinationDialog')
    assert.equal(await copy.locator('select').inputValue(), 'Second')
    await copy.locator('input').fill('1')
    await copy.locator('..').getByRole('button', { name: 'Add card', exact: true }).click()
    await page.evaluate(() => { window.selectRecording('Second'); window.openRecordingReviewDialog() })
    assert.match((await ordered())[0], /First card/)
    await close('recordingReviewDialog')
    // Incoming captions use the same destination and insertion semantics.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('cupitorCaptionCapture', { detail: {
      source: 'page', title: 'Sample passage', url: 'https://example.org/book', lines: [{ start: 0, text: 'Captured at index two.' }]
    } })))
    assert.equal(await page.locator('#capCapPlaylist').inputValue(), 'Second')
    await page.locator('#captionCaptureDialog .card-placement input').fill('2')
    await click('#capCapSave')
    await page.locator('#captionCaptureDialog').waitFor({ state: 'hidden' })
    assert.match((await ordered())[1], /Captured at index two/)
    await close('recordingReviewDialog')
    await page.evaluate(() => window.startRecording())
    await page.locator('#searchText').fill('hagla')
    await page.locator('#searchText').press('Tab')
    const capture = page.locator('#result .capture-btn:visible').first()
    await capture.waitFor({ state: 'visible' })
    const beforeCancel = await page.evaluate(() => JSON.stringify(window._recordings))
    await capture.click()
    await close('cardDestinationDialog')
    assert.equal(await page.evaluate(() => JSON.stringify(window._recordings)), beforeCancel)
    await capture.click()
    const result = page.locator('#cardDestinationDialog')
    assert.equal(await result.locator('select').inputValue(), 'Second')
    await result.locator('input').fill('1')
    await result.locator('..').getByRole('button', { name: 'Add card', exact: true }).click()
    await page.evaluate(() => { window.stopRecording(); window.openRecordingReviewDialog() })
    assert.match((await ordered())[0], /testVideo/)
    await close('recordingReviewDialog')
    // All settings remain reachable, with one visible section at a time.
    await click('#toggleSettingsPanelBtn')
    assert.equal(await page.locator('.settings-section-picker select').inputValue(), 'tools', 'Settings opens on Tools')
    assert.equal(await page.locator('.settings-nav [aria-current="page"]').innerText(), 'Tools')
    assert.equal(await page.locator('.settings-content section:visible').count(), 1)
    assert.equal(await page.locator('#settings-section-tools').isVisible(), true)
    const advanced = page.locator('#settings-section-tools details')
    const channels = advanced.getByRole('button', {name:'Channels…',exact:true})
    assert.equal(await channels.isVisible(), false, 'maintenance starts collapsed')
    await advanced.locator('summary').click()
    assert.equal(await channels.isVisible(), true)
    assert.equal(await advanced.getByRole('button', {name:'Rare words…',exact:true}).isVisible(), true)
    await advanced.locator('summary').click()
    assert.equal(await channels.isVisible(), false)
    const choose = async key => {
      if (mobile) await page.locator('.settings-section-picker select').selectOption(key)
      else await click(`[data-settings-section="${key}"]`)
    }
    for (const key of ['search', 'playback', 'practice', 'tools', 'data']) {
      await choose(key)
      assert.equal(await page.locator('.settings-content section:visible').count(), 1)
      assert.equal(await page.locator(`#settings-section-${key}`).isVisible(), true)
    }
    await choose('practice')
    await page.locator('#practiceRevealMode').selectOption('both')
    assert.equal(await page.evaluate(() => window._appSettings.practiceRevealMode), 'both')
    await choose('playback')
    await page.locator('#recPlayYouTubeClipSeconds').fill('13')
    await page.locator('#recPlayYouTubeClipSeconds').press('Tab')
    assert.equal(await page.evaluate(() => window._appSettings.recPlayYouTubeClipSeconds), 13)
    await screenshot('settings')
    await page.setViewportSize({ width: 320, height: 740 })
    assert.equal(await page.locator('#settingsPanel').evaluate(el => el.scrollWidth <= el.clientWidth + 1), true)
    await close('settingsPanel')
    await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 })
    // Space must never start a hidden previous recording on a silent card.
    await page.evaluate(wav => {
      window.AudioBridge = { postMessage(raw) {
        const r = JSON.parse(raw)
        queueMicrotask(() => window.__cupAudio({ rid: r.rid, result: r.op === 'load' ? wav : null }))
      } }
      window.__audioStarts = 0
      const play = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () { window.__audioStarts++; return play.call(this) }
      window.openPracticeMode({ queue: [
        { manual: true, id: 'voice', source: 'Recorded card', sourceAudioUrl: 'file:///voice.wav' },
        { manual: true, id: 'silent', source: 'Silent card' }
      ], temporary: true })
    }, silentWav())
    await page.waitForFunction(() => document.querySelector('#practiceAudio audio')?.getAttribute('src'))
    await page.evaluate(() => document.activeElement.blur())
    await page.keyboard.press('Space')
    await page.waitForFunction(() => window.__audioStarts > 0)
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => window._practiceIdx === 1)
    const starts = await page.evaluate(() => window.__audioStarts)
    await page.keyboard.press('Space')
    await page.keyboard.press('Space')
    assert.equal(await page.evaluate(() => window.__audioStarts), starts)
    assert.equal(await page.locator('#practiceAudio audio').getAttribute('src'), null)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('filterData', { detail: { text: 'hagla' } })))
    await page.waitForFunction(() => window._practiceMinimized && !document.body.classList.contains('practice-mode'))
    assert.equal(await page.locator('#searchText').inputValue(), 'hagla')
    assert.equal(await page.locator('#searchText').isVisible(), true)
    assert.equal(await page.evaluate(() => window._practiceActive && window._practiceIdx === 1), true)
    await page.evaluate(() => window.closePracticeMode())
    await page.evaluate(() => {
      window.__playerTask = window.playRecording({ queue: [
        { manual: true, id: 'voice-deck', source: 'Player card', sourceAudioUrl: 'file:///voice.wav' }
      ], temporary: true, shuffle: false })
    })
    await page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('filterData', { detail: { text: 'sova' } })))
    await page.waitForFunction(() => window._recPlayMinimized && !document.body.classList.contains('rec-playing'))
    assert.equal(await page.evaluate(() => window._playingRecording && window._recPlayPaused && window._recPlayIndex === 0), true)
    assert.equal(await page.locator('#searchText').inputValue(), 'sova')
    assert.equal(await page.locator('#searchText').isVisible(), true)
    await page.evaluate(() => { window.stopPlayingRecording(); return window.__playerTask })
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: insertion, destination memory, settings, silent-card Space and native lookup passed`)
  } finally { await page.close() }
}
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { for (const mobile of [false, true]) await check(browser, mobile) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
