// Consecutive manual cards use the actual Taare Zameen Par URLs. The iframe
// double keeps a cued start separately from getCurrentTime(), as a parked
// embed may report zero until playback begins.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { fixtures, choosePlaylist } = require('./recorded-playlist-pages.cjs')
const data = require('./fixtures/recorded-playlists.json')
const name = 'Taare Zameen Par - 2'
const actualCards = data.playlists[name].items.Manual.Card

async function checkManualVideo(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 393 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  page.setDefaultTimeout(7000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', fixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const click = async locator => {
    if (await page.evaluate(() => document.body.classList.contains('study-controls-hidden'))) {
      if (mobile) await page.touchscreen.tap(2, 52); else await page.mouse.click(2, 52)
    }
    if (mobile) await locator.tap(); else await locator.click()
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async ({ data, name }) => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      window._recordings = data.playlists
      data.otherNames.forEach(name => { window._recordings[name] = { items: {} } })
      Object.assign(window._appSettings, { recPlayShuffle: false, recPlayLoop: 'off', practiceRevealMode: 'both' })
      const s = window.__manualYT = { id: 'boot', time: 0, start: 0, state: 2, muted: false, events: [], delay: 40 }
      const log = action => s.events.push({ action, id: s.id, time: s.time, start: s.start, muted: s.muted })
      window.ytPlayer = {
        isMuted: () => s.muted, mute: () => { s.muted = true }, unMute: () => { s.muted = false; log('unmute') },
        getVideoData: () => ({ video_id: s.id }), getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
        getCurrentTime: () => s.time, getPlayerState: () => s.state, getDuration: () => 10000,
        getIframe: () => document.getElementById('youtubePlayer'), addEventListener: () => {},
        getAvailablePlaybackRates: () => [0.5, 0.75, 1], getPlaybackRate: () => 1, setPlaybackRate: () => {},
        pauseVideo: () => { if (s.state !== 5) s.state = 2; log('pause') },
        cueVideoById: value => setTimeout(() => {
          s.id = value.videoId; s.start = value.startSeconds || 0; s.time = 0; s.state = 5; log('cue')
        }, s.delay),
        loadVideoById: value => { s.id = value.videoId || value; s.start = value.startSeconds || 0; s.time = s.start; s.state = 1; log('load') },
        seekTo: value => { if (!s.ignoreSeeks) s.time = value; log('seek') },
        playVideo: () => { if (s.state === 5) s.time = s.start; s.state = 1; log('play') },
      }
      window.ytPlayerReady = true
      const embeddedPlay = document.createElement('button')
      embeddedPlay.id = 'fixtureEmbeddedPlay'; embeddedPlay.textContent = 'Embedded YouTube Play'
      embeddedPlay.onclick = () => window.ytPlayer.playVideo()
      document.getElementById('youtubePlayer').appendChild(embeddedPlay)
      window.openRecordingReviewDialog()
    }, { data, name })
    await choosePlaylist(page, name, mobile)
    const dialog = page.locator('#recordingReviewDialog').locator('..')
    const playAll = dialog.getByRole('button', { name: 'Play All', exact: true })
    await click(dialog.getByRole('button', { name: 'Practice', exact: true }))
    // Include an absent timestamp and a new video, then return to the same
    // film. The first three cards retain their original stored data.
    const queue = actualCards.slice(0, 3).concat([
      { manual: true, id: 'no-time', source: 'No timestamp', mediaUrl: 'https://youtu.be/KX6xaWY99wQ' },
      { manual: true, id: 'hms-time', source: 'Different video', mediaUrl: 'https://youtu.be/testVideo02?t=1m35s' },
      actualCards[1],
    ])
    await page.evaluate(queue => { window.closePracticeMode(); window.openPracticeMode({ queue }) }, queue)
    const starts = [2410, 2419, 2515, 0, 95, 2419]
    for (let i = 0; i < queue.length; i++) {
      const id = i === 4 ? 'testVideo02' : 'KX6xaWY99wQ'
      if (i) await click(page.locator('#practiceMode .practice-next'))
      await page.waitForFunction(({ i, start, id }) => window._practiceIdx === i &&
        window.__manualYT.state === 5 && window.__manualYT.start === start && window.__manualYT.id === id,
      { i, start: starts[i], id })
      assert.equal(await page.evaluate(() => window.__manualYT.time), 0, 'a cued embed can report zero before playback')
      assert.equal(await page.evaluate(() => window.__manualYT.events.at(-1).action), 'cue', 'navigation only cues; it never autoplays')
      // The iframe's own Play must use THIS card, even without clicking the
      // app's linked-media button first.
      await click(page.locator('#fixtureEmbeddedPlay'))
      assert.equal(await page.evaluate(() => window.__manualYT.time), starts[i])
      assert.equal(await page.evaluate(() => window.__manualYT.state), 1)
      // Explicit Play / replay also starts at the URL time, rather than a
      // cached playhead from the preceding card of the same film.
      await page.evaluate(() => { window.__manualYT.time += 10 })
      await click(page.locator('#practiceMode .practice-media-link'))
      await page.waitForFunction(start => window.__manualYT.state === 1 &&
        Math.abs(window.__manualYT.time - start) < 0.5 && !window._practicePlayPending, starts[i])
    }
    // Regression: restoring a minimized manual card must prepare its saved
    // YouTube timestamp without going through the generic 0-second media
    // loader or starting playback. A parked iframe can report 0 even when
    // the restored card is linked to a later moment.
    await page.evaluate(() => {
      window.minimizePracticeMode()
      window.__manualYT.events = []
      window.__manualYT.time = 0
      window.__manualYT.start = 0
      window.__manualYT.state = 2
      window.restorePracticeMode()
    })
    await page.waitForFunction(expected => window.__manualYT.state === 5
      && window.__manualYT.start === expected
      && window.__manualYT.events.some(e => e.action === 'cue'), starts.at(-1))
    assert.equal(await page.evaluate(() => window.__manualYT.events
      .filter(e => ['load', 'play', 'seek'].includes(e.action)).length), 0,
      'restore only cues at the card timestamp, it does not reload or autoplay')
    await click(page.locator('#fixtureEmbeddedPlay'))
    assert.equal(await page.evaluate(() => window.__manualYT.time), starts.at(-1),
      'the iframe Play button resumes from the timestamp after restore')

    // If the iframe ignores seeking back from zero, reload with startSeconds.
    // Sound is restored only once playback has been verified at that time.
    await page.evaluate(() => { window.__manualYT.time = 0; window.__manualYT.ignoreSeeks = true; window.__manualYT.events = [] })
    await click(page.locator('#practiceMode .practice-media-link'))
    await page.waitForFunction(() => !window._practicePlayPending && window.__manualYT.events.some(e => e.action === 'load'))
    assert.equal(await page.evaluate(() => window.__manualYT.time), 2419)
    assert.deepEqual(await page.evaluate(() => window.__manualYT.events.filter(e => e.action === 'unmute').map(e => e.time)), [2419])
    await page.evaluate(() => { window.__manualYT.ignoreSeeks = false })
    // A delayed ready/cue or link click cannot start over the next card.
    await page.evaluate(() => { window.ytPlayerReady = false; window.__manualYT.events = [] })
    await click(page.locator('#practiceMode .practice-media-link'))
    await click(page.locator('#practiceMode .practice-next'))
    await page.evaluate(() => { window.ytPlayerReady = true })
    await page.waitForFunction(() => window.__manualYT.state === 5 && window.__manualYT.start === 2410)
    await page.waitForFunction(() => !window.__manualYT.muted)
    assert.equal(await page.evaluate(() => window.__manualYT.events.filter(e => ['load', 'play', 'seek'].includes(e.action)).length), 0)
    // Preserve a deliberate mute, and finish a player-ready wait within the
    // same 20-second budget rather than leaving the controls pending forever.
    await page.evaluate(() => { window.__manualYT.muted = true })
    await click(page.locator('#practiceMode .practice-media-link'))
    await page.waitForFunction(() => !window._practicePlayPending && window.__manualYT.state === 1)
    assert.equal(await page.evaluate(() => window.__manualYT.muted), true)
    await page.clock.install()
    await page.evaluate(() => { window.ytPlayerReady = false; window.__manualYT.muted = false })
    await click(page.locator('#practiceMode .practice-media-link'))
    await page.clock.runFor(21000)
    assert.equal(await page.evaluate(() => !!window._practicePlayPending), false)
    assert.equal(await page.evaluate(() => window.__manualYT.state), 2)
    assert.equal(await page.evaluate(() => window.__manualYT.muted), false)
    await page.clock.resume()
    await page.evaluate(() => { window.ytPlayerReady = true })
    await page.evaluate(() => { window.closePracticeMode(); window.openRecordingReviewDialog() })
    assert.equal(await playAll.isEnabled(), false, 'manual-only playlists use Practice')
    assert.equal(await dialog.getByRole('button', { name: 'Practice', exact: true }).isEnabled(), true)
    // The whole playlist decides, including captured items beyond page one.
    await choosePlaylist(page, 'Tillåt mig tvivla - Ord', mobile)
    assert.equal(await playAll.isEnabled(), true, 'captured playlists keep Play All')
    await page.evaluate(() => {
      const items = Array.from({ length: 50 }, (_, i) => ({ manual: true, id: 'manual-' + i, source: 'Card ' + i }))
      items.push({ id: 'testVideo01', source: 'YouTube', timeStart: 1, timeEnd: 3 })
      window._recordings.Mixed = { items: { Mixed: { Cards: items } } }
      window.selectRecording('Mixed'); window.openRecordingReviewDialog()
    })
    assert.equal(await playAll.isEnabled(), true, 'a captured item on page two enables Play All')
    await page.evaluate(() => { window._recordings.Mixed.items.Mixed.Cards.pop(); window.openRecordingReviewDialog() })
    assert.equal(await playAll.isEnabled(), false, 'refresh updates Play All when the last captured item is removed')
    await page.evaluate(name => {
      window._recordings.VirtualManual = { virtual: true, members: [name] }
      window.selectRecording('VirtualManual'); window.openRecordingReviewDialog()
    }, name)
    assert.equal(await playAll.isEnabled(), false, 'virtual playlists also resolve manual-only members')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: manual Practice URL timestamps, embedded/app Play, replay, navigation cancellation and manual-only Play All passed`)
  } catch (error) {
    console.error(await page.evaluate(() => ({ name: window._recording?.currentName, selected: document.getElementById('recRecSelect')?.value,
      dropdowns: document.querySelectorAll('.select2-dropdown').length, player: window.__manualYT })), errors)
    throw error
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    if (!process.argv.includes('--mobile-only')) await checkManualVideo(browser, false)
    if (!process.argv.includes('--desktop-only')) await checkManualVideo(browser, true)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
