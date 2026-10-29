const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')

const index = ['testVideo01', 'testVideo02'].map(link => ({ link, name: 'Test channel || Phrase examples || ' + link, source: 'YouTube' }))
const cue = (i, start, end, text) => `${i}\n${start},000 --> ${end},000\n${text}\n\n`
const srts = [
  cue(1, '00:00:01', '00:00:03', 'Det börjar här.') +
  cue(2, '00:00:03', '00:00:05', 'Du har hamnat i rätta händer.') +
  cue(3, '00:00:05', '00:00:07', 'Allt du behöver.') +
  cue(4, '00:02:00', '00:02:02', 'Men nu är det i rätta') +
  cue(5, '00:02:02', '00:02:04', 'händer igen.') +
  cue(6, '00:15:00', '00:15:02', 'Det är i rätta händer igen.'),
  cue(1, '00:01:00', '00:01:02', 'Saken är i rätta händer.'),
]

async function fixtures(route) {
  const url = new URL(route.request().url())
  if (url.hostname !== '127.0.0.1') {
    const file = decodeURIComponent(url.pathname)
    if (file.endsWith('/srts/index.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify(index) })
    if (file.endsWith('.srt')) return route.fulfill({ contentType: 'text/plain', body: srts[file.includes('testVideo02') ? 1 : 0] })
    if (file.endsWith('/vocabulary.txt')) return route.fulfill({ contentType: 'text/plain', body: '#Phrases\n(right)|i rätta händer|\n' })
  }
  return serveFixtures(route)
}

async function checkSearchPlaylist(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 360 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', fixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const click = async selector => {
    await page.keyboard.press('Shift') // reveal study controls without changing the card
    await page.locator(selector).click()
  }
  const storedGap = () => page.evaluate(() => Object.entries(localStorage)
    .filter(([key]) => key.includes('appSettings')).map(([, value]) => JSON.parse(value).recPlayGapSeconds))
  const gap = () => page.locator('#recPlayingBanner .rec-pb-gap-val').innerText()
  let clockInstalled = false
  const start = async (savedGap = 7, count = 4) => {
    const plays = await page.evaluate(() => window.__yt.plays)
    await click('#searchPlaylistCreateBtn')
    if (clockInstalled) await page.clock.runFor(500)
    await page.waitForFunction(({ plays, count }) => window._playingRecording && window._recPlayQueue?.length === count &&
      window.__yt.state === 1 && window.__yt.plays > plays && !window.seekRequestProcessing &&
      document.querySelector('#recPlayingBanner'), { plays, count })
    assert.equal(await gap(), '30s')
    assert.equal(await page.evaluate(() => window._appSettings.recPlayGapSeconds), savedGap)
  }
  const search = async (query, count) => {
    await page.locator('#searchText').fill(query)
    await page.locator('#searchText').press('Tab')
    await page.waitForFunction(({ query, count }) => window._librarySearchText === query &&
      document.querySelectorAll('#result .l-accordion[accordion-rendered]').length === count &&
      !document.querySelector('#result').textContent.includes('Loading…'), { query, count })
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.evaluate(() => {
      Object.assign(window._appSettings, { autoPrefixSearch: false, contextLinesBefore: 1, contextLinesAfter: 1,
        recPlayGapSeconds: 7, recPlayShuffle: false, recPlayLoop: 'off' })
      window.saveAppSettings()
      $('#numberOfFindingsToShow').val('1')
      const s = window.__yt = { id: 'cold', time: 0, state: 2, loads: [], plays: 0 }
      window.ytPlayer = {
        getVideoData: () => ({ video_id: s.id }), getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
        getIframe: () => document.getElementById('youtubePlayer'), getCurrentTime: () => s.time,
        getPlayerState: () => s.state, getDuration: () => 2000, getPlaybackRate: () => 1,
        setPlaybackRate: () => {}, getAvailablePlaybackRates: () => [1], addEventListener: () => {},
        pauseVideo: () => { s.state = 2 }, playVideo: () => { s.state = 1; s.plays++ }, seekTo: time => { s.time = time },
        loadVideoById: value => { s.id = value.videoId; s.time = value.startSeconds || 0; s.state = 1; s.loads.push(value) },
        cueVideoById: value => { s.id = value.videoId; s.time = value.startSeconds || 0; s.state = 5 },
      }
      window.ytPlayerReady = true
      window.__savedPlaylists = JSON.stringify(window._recordings)
    })
    await search('händer|behöver|saknas', 2)
    assert.equal(await page.locator('#searchPlaylistSelectBtn').isVisible(), true)
    assert.equal(await page.locator('#result .l-accordion #searchPlaylistSelectBtn').count(), 0,
      'one playlist button sits outside all headings')
    assert.equal(await page.locator('#searchPlaylistActions').isVisible(), false)
    assert.equal(await page.locator('.search-playlist-checkbox:visible').count(), 0)
    await click('#searchPlaylistSelectBtn')
    const phrase = page.getByRole('checkbox', { name: 'Select clips for händer', exact: true })
    const other = page.getByRole('checkbox', { name: 'Select clips for behöver', exact: true })
    const wasOpen = await phrase.locator('xpath=ancestor::h5').evaluate(el => el.classList.contains('active'))
    await phrase.check()
    assert.equal(await phrase.locator('xpath=ancestor::h5').evaluate(el => el.classList.contains('active')), wasOpen,
      'selecting a heading does not expand or collapse it')
    assert.equal(await page.locator('#searchPlaylistActions').isVisible(), true)
    await other.check()
    assert.equal(await page.locator('#searchPlaylistSelectedCount').innerText(), '2')
    await page.locator('#searchPlaylistMaxClips').fill('0')
    await click('#searchPlaylistCreateBtn')
    assert.equal(await page.evaluate(() => !!window._playingRecording), false, 'zero is rejected')
    await page.locator('#searchPlaylistMaxClips').fill('1.5')
    assert.equal(await page.locator('#searchPlaylistMaxClips').evaluate(el => el.checkValidity()), false, 'fractional limits are rejected')
    await page.locator('#searchPlaylistMaxClips').fill('2')
    await other.uncheck()
    await phrase.uncheck()
    assert.equal(await page.locator('#searchPlaylistActions').isVisible(), false, 'no selection hides creation controls')
    await phrase.check()
    await other.check()
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await page.locator('#result').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `search-selection-${mobile ? 'mobile' : 'desktop'}.png`) })
    }
    // Paging rebuilds the result DOM, but retains all selected headings and the limit.
    await page.evaluate(async () => { window.SEARCH_RESULT_PAGE_SIZE = 1; await window.loadSearchResultsPage(1) })
    assert.equal(await page.locator('#result .l-accordion').count(), 1)
    assert.equal(await page.locator('#searchPlaylistSelectedCount').innerText(), '2')
    assert.equal(await page.locator('#searchPlaylistMaxClips').inputValue(), '2')
    await start(7, 3)
    assert.deepEqual(await page.evaluate(() => window._recPlayQueue.map(it => it.word).sort()), ['behöver', 'händer', 'händer'],
      'the cap applies to each selected heading, including selections on another page')
    await page.evaluate(() => window.stopPlayingRecording())
    await page.waitForFunction(() => !window._playingRecording)
    await page.evaluate(async () => { window.SEARCH_RESULT_PAGE_SIZE = 50; await window.loadSearchResultsPage(0) })
    await click('#searchPlaylistSelectBtn')
    assert.equal(await page.locator('.search-playlist-checkbox:visible').count(), 0, 'cancel hides all checkboxes')
    await click('#searchPlaylistSelectBtn')
    assert.equal(await page.locator('.search-playlist-checkbox:checked').count(), 0, 'cancel clears selection')
    await search('zzzzzzzznotfound', 1)
    assert.equal(await page.locator('#searchPlaylistSelectBtn').count(), 0, 'no clips means no playlist button')
    await search('i rätta händer', 1)
    assert.equal(await page.locator('#searchPlaylistActions').isVisible(), false, 'new search resets selection')
    assert.equal(await page.locator('.search-playlist-checkbox:visible').count(), 0)
    await click('#searchPlaylistSelectBtn')
    await page.getByRole('checkbox', { name: 'Select clips for i rätta händer', exact: true }).check()
    assert.equal(await page.locator('#searchPlaylistMaxClips').inputValue(), '', 'new search resets the cap to all clips')
    assert.equal(await page.locator('#result .srt-file').count(), 1, 'fixture renders one of four hits')
    assert.deepEqual(await storedGap(), [7])
    const active = await page.locator('#result .l-accordion').evaluate(el => el.classList.contains('active'))
    const button = page.locator('#searchPlaylistCreateBtn')
    const box = await button.boundingBox()
    assert(box && box.width >= 44 && box.x >= 0 && box.x + box.width <= (mobile ? 360 : 1280))
    if (process.env.SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await page.locator('#result').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `search-playlist-${mobile ? 'mobile' : 'desktop'}.png`) })
    }
    await start()
    assert.equal(await page.locator('#result .l-accordion').evaluate(el => el.classList.contains('active')), active,
      'play button does not toggle the accordion')
    const queue = await page.evaluate(() => window._recPlayQueue)
    assert.equal(queue.length, 4, 'plays hidden hits too')
    assert(queue.every(it => it._temporary))
    assert.deepEqual(queue.filter(it => it.id === 'testVideo01').map(it => [it.lineIndex, it.timeStart, it.timeEnd]),
      [['2', 1, 7], ['6', 900, 902], ['4', 120, 124]])
    await click('#recPlayingMinimizeBtn')
    assert.equal(await gap(), '30s', 'minimize keeps the session gap')
    await click('.rec-pill-restore')
    if (mobile) await click('#recPlayingBanner .rec-pb-info-btn')
    await click('#recPlayingBanner .rec-pb-gap-inc')
    assert.equal(await gap(), '35s')
    await page.evaluate(() => window.saveAppSettings())
    assert.deepEqual(await storedGap(), [7], 'saving another setting cannot persist the temporary gap')
    await click('#recPlayingCloseBtn')
    await page.waitForFunction(() => !window._playingRecording && !window._recPlayQueue)
    assert.equal(await page.locator('#recPlayGapSeconds').inputValue(), '7')
    await start()
    await page.evaluate(() => { document.activeElement?.blur() })
    await page.keyboard.press('p')
    await page.waitForFunction(() => window._practiceActive)
    await page.keyboard.press('p')
    await page.waitForFunction(() => !window._practiceActive && window._playingRecording)
    assert.equal(await gap(), '30s', 'Practice to Player preserves the temporary gap')
    await page.keyboard.press('p')
    await page.waitForFunction(() => window._practiceActive)
    await click('#practiceMode .practice-close')
    await page.waitForFunction(() => !window._playingRecording)
    assert.equal(await page.locator('#recPlayGapSeconds').inputValue(), '7', 'closing Practice restores the gap')
    await start()
    await page.evaluate(() => { window.playRecording({ queue: window._recPlayQueue, temporary: true, startPaused: true }) })
    assert.equal(await gap(), '7s', 'a replacement playlist uses the saved gap')
    await page.evaluate(() => window.stopPlayingRecording())
    await start()
    await page.evaluate(() => {
      window.openPracticeMode({ queue: [{ id: 'other-card', manual: true, source: 'Other deck', target: 'Other' }], single: true })
      document.activeElement?.blur()
    })
    await page.keyboard.press('p')
    await page.waitForFunction(() => !window._practiceActive && window._playingRecording)
    assert.equal(await gap(), '7s', 'switching an unrelated Practice deck to Player drops the old override')
    await page.evaluate(() => window.stopPlayingRecording())
    await page.clock.install()
    clockInstalled = true
    await start()
    await page.evaluate(() => { window.__yt.time = window._recPlayQueue[0].timeEnd })
    await page.clock.runFor(600)
    assert.equal(await page.locator('#recPlayingBanner .rec-pb-bar').evaluate(el => el.classList.contains('gap')), true,
      JSON.stringify(await page.evaluate(() => ({ yt: window.__yt, paused: window._recPlayPaused,
        phase: window._recPlayPhase, index: window._recPlayIndex, playing: window._playingRecording }))))
    await page.clock.runFor(28000)
    assert.equal(await page.evaluate(() => window._recPlayIndex), 0, 'next clip waits for 30 seconds')
    await page.clock.runFor(2100)
    assert.equal(await page.evaluate(() => window._recPlayIndex), 1)
    // Finish the last card naturally; completion must restore the gap too.
    await page.evaluate(() => { window._recNavGotoIndex = 3 })
    await page.clock.runFor(1000)
    assert.equal(await page.evaluate(() => window._recPlayIndex), 3)
    await page.evaluate(() => { window.__yt.time = window._recPlayQueue[3].timeEnd })
    await page.clock.runFor(1000)
    assert.equal(await page.evaluate(() => window._playingRecording), false)
    assert.equal(await page.locator('#recPlayGapSeconds').inputValue(), '7')
    assert.deepEqual(await storedGap(), [7])
    assert.equal(await page.evaluate(() => JSON.stringify(window._recordings) === window.__savedPlaylists), true,
      'temporary playback never creates or changes saved playlists')
    await page.evaluate(() => { window._appSettings.recPlayGapSeconds = 0; window.saveAppSettings() })
    await start(0)
    await click('#recPlayingCloseBtn')
    await page.clock.runFor(400)
    assert.equal(await page.locator('#recPlayGapSeconds').inputValue(), '0', 'a saved zero-second gap also restores')
    assert.deepEqual(await storedGap(), [0])
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: phrase queue, sparse/cross-line clips, 30s gap, minimize, Practice, close and completion passed`)
  } catch (error) {
    console.error(await page.evaluate(() => ({ search: window._librarySearchText,
      headings: [...document.querySelectorAll('#result .l-accordion')].map(el => el.textContent),
      result: document.querySelector('#result')?.textContent.slice(0, 1000) })), errors)
    throw error
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { for (const mobile of [false, true]) await checkSearchPlaylist(browser, mobile) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
