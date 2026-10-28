// Real app UI with a deterministic YouTube API double: autoplay is logged at
// the instant loadVideoById/playVideo is called, so a later pause cannot hide it.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')

async function checkPracticeControls(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 430 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
    await page.route('**/*', serveFixtures)
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    const blur = () => page.evaluate(() => document.activeElement?.blur())
    const state = () => page.evaluate(() => ({ ...window.__yt, events: window.__yt.events.slice() }))
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      await page.evaluate(() => {
        const s = window.__yt = { id: 'boot-video', time: 0, state: 2, rate: 1, muted: false, events: [], holdSeek: false, holdId: false }
        const log = (action, data) => s.events.push({ action, id: s.id, time: s.time, muted: s.muted, ...data })
        window.ytPlayer = {
          isMuted: () => s.muted,
          mute: () => { s.muted = true; log('mute') },
          unMute: () => { s.muted = false; log('unmute') },
          pauseVideo: () => { log('pause'); if (s.delayedCommands) setTimeout(() => { s.state = 2 }, 80); else s.state = 2 },
          playVideo: () => { s.state = 1; log('play') },
          loadVideoById: value => { s.id = typeof value === 'string' ? value : value.videoId; s.time = value.startSeconds || 0; s.state = 1; log('load') },
          cueVideoById: value => {
            const cue = () => { s.id = value.videoId; s.time = value.startSeconds; s.state = 5; log('cue') }
            if (s.delayedCommands) {
              setTimeout(() => { s.state = 1; log('buffered-play') }, 100)
              setTimeout(cue, 200)
            } else cue()
          },
          seekTo: value => { log('seek', { target: value }); if (!s.holdSeek) s.time = value },
          getPlayerState: () => s.state, getCurrentTime: () => s.time, getDuration: () => 1000,
          getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id,
          getVideoData: () => ({ video_id: s.holdId ? 'previous-video' : s.id }),
          getIframe: () => document.getElementById('youtubePlayer'),
          getAvailablePlaybackRates: () => [0.5, 0.75, 1], getPlaybackRate: () => s.rate,
          setPlaybackRate: rate => { s.rate = rate; log('rate', { rate }) },
          addEventListener: () => {}
        }
        window.ytPlayerReady = false
        window._appSettings.practiceSpeedOptions = [1, 0.75, 0.5]
        window._appSettings.practicePlaybackRate = 1
        window._appSettings.recPlayShuffle = false
        window._appSettings.practiceRevealMode = 'flip'
        const cards = [
          { id: 'testVideo01', word: 'färgsprakande', source: 'YouTube', timeStart: 1, timeEnd: 3, lineIndex: 1 },
          { id: 'testVideo02', word: 'hagla', source: 'YouTube', timeStart: 3, timeEnd: 5, lineIndex: 2 },
          { id: 'testVideo01', word: 'väljarkår', source: 'YouTube', timeStart: 5, timeEnd: 7, lineIndex: 3 },
          { manual: true, id: 'mc-test', source: 'hej', target: 'hello', mediaUrl: 'https://www.youtube.com/watch?v=testVideo03&t=12' }
        ]
        window.__practiceTestCards = cards
        window.openPracticeMode({ queue: cards, single: true })
      })
      await page.locator('#practiceMode').waitFor({ state: 'visible' })
      await blur()
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowLeft')
      await page.evaluate(() => window.onPlayerReady({ target: window.ytPlayer }))
      await page.waitForFunction(() => window.__yt.events.some(e => e.action === 'cue' && e.id === 'testVideo01'))
      assert.equal((await state()).events.filter(e => ['play', 'load', 'seek'].includes(e.action)).length, 0,
        'cold ready, rapid navigation and returning to the same card must stay silent')

      // An old playing card stops in the navigation handler, before any
      // subtitle/range lookup can complete. The new card is only cued.
      await page.evaluate(() => { window.__yt.state = 1; window.__yt.events = [] })
      await page.keyboard.press('j')
      assert([2, 5].includes(await page.evaluate(() => window.__yt.state)))
      assert.equal((await state()).events[0].action, 'mute', 'sound stops before the iframe processes pause')
      await page.waitForFunction(() => window.__yt.id === 'testVideo02' && window.__yt.state === 5)
      assert.equal((await state()).events.filter(e => ['play', 'load', 'seek'].includes(e.action)).length, 0)
      await page.keyboard.press('Space')
      await page.waitForFunction(() => window.__yt.state === 1 && !window._practicePlayPending)
      await page.waitForTimeout(300) // the former delayed cue-pause fired at 120ms
      assert.equal((await state()).state, 1, 'intentional playback is not cut off by a late cue')
      await page.evaluate(() => { window.__yt.time = 3.4 })
      await page.keyboard.press('Space')
      assert.equal((await state()).state, 2)
      assert.equal((await state()).muted, false, 'a deliberate pause preserves the sound setting')
      await page.keyboard.press('Space')
      assert.equal((await state()).state, 1)
      assert.equal((await state()).time, 3.4, 'Space resumes a paused clip without rewinding')

      await page.keyboard.press('r')
      assert.equal(await page.evaluate(() => window._practiceFlipped), true)
      const direction = await page.evaluate(() => window._practiceFrontIsSource)
      await page.keyboard.press('d')
      assert.equal(await page.evaluate(() => window._practiceFrontIsSource), !direction)
      await page.waitForFunction(() => window.__yt.state === 5)
      await page.keyboard.press('s')
      assert.equal(await page.evaluate(() => window._practicePlaybackRate), 0.75)
      await page.keyboard.press('k')
      await page.waitForFunction(() => window._practiceIdx === 0 && window.__yt.state === 5)

      // Cross-frame commands and state acknowledgments arrive later. The
      // previous video must remain inaudible throughout that transition.
      await page.waitForFunction(() => !window.__yt.muted)
      await page.evaluate(() => { window.__yt.state = 1; window.__yt.events = []; window.__yt.delayedCommands = true })
      await page.keyboard.press('ArrowRight')
      assert.equal((await state()).muted, true)
      await page.waitForFunction(() => window.__yt.id === 'testVideo02' && window.__yt.state === 5 && !window.__yt.muted)
      const buffered = (await state()).events.filter(e => e.action === 'buffered-play')
      assert(buffered.length > 0 && buffered.every(e => e.muted), 'late buffered playback never becomes audible')
      await page.evaluate(() => { window.__yt.delayedCommands = false })
      await page.keyboard.press('ArrowLeft')
      await page.waitForFunction(() => window._practiceIdx === 0 && window.__yt.state === 5)

      await page.evaluate(() => { window.ytPlayerReady = false; window.__yt.events = [] })
      await page.keyboard.press('ArrowRight')
      assert.equal((await state()).muted, true)
      await page.locator('#practiceMode .practice-minimize').click()
      assert.equal((await state()).muted, false, 'minimize releases a pending transition mute')
      await page.evaluate(() => { window.ytPlayerReady = true })
      await page.waitForTimeout(200)
      assert.equal((await state()).events.filter(e => e.action === 'cue').length, 0, 'a parked cue cannot change the main player')
      await page.locator('#practiceMode .practice-restore-btn').click()
      await blur()
      await page.keyboard.press('ArrowLeft')
      await page.waitForFunction(() => window._practiceIdx === 0 && window.__yt.state === 5)

      // Inputs, editable text, composition and dialogs retain their keys.
      await page.locator('#practiceMode .practice-settings').click()
      const input = page.locator('#practiceMode .practice-speeds-input')
      await input.fill('1, 0.75, 0.5')
      await input.press('j')
      await input.press('Space')
      await input.press('?')
      await input.press('/')
      assert((await input.inputValue()).includes('/'), 'slash remains normal text in settings inputs')
      assert.equal(await page.evaluate(() => window._practiceIdx), 0)
      assert.equal(await page.locator('#keyboardShortcutsDialog:visible').count(), 0)
      await page.evaluate(() => {
        const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.id = 'shortcutEditor'
        document.getElementById('practiceMode').appendChild(editor); editor.focus()
      })
      await page.keyboard.press('j')
      assert.equal(await page.evaluate(() => window._practiceIdx), 0)
      await page.evaluate(() => document.getElementById('shortcutEditor').remove())
      await input.fill('1, 0.75, 0.5')
      await page.locator('#practiceMode .practice-settings').click()
      await blur()
      await page.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', isComposing: true, bubbles: true })))
      assert.equal(await page.evaluate(() => window._practiceIdx), 0)
      await page.keyboard.press('?')
      assert.equal(await page.locator('#keyboardShortcutsDialog:visible').count(), 0, 'question mark no longer opens help')
      await page.locator('#practiceMode .practice-settings').click()
      await page.locator('#practiceMode .keyboard-shortcuts-btn').click()
      await page.locator('#keyboardShortcutsDialog').waitFor({ state: 'visible' })
      // The dialog is generated from the same list as the keyboard matcher.
      // New shortcuts must not break the browser test's stale row count.
      const shortcutCount = await page.evaluate(async () => {
        const { KEYBOARD_SHORTCUTS } = await import('/language/keyboard-shortcuts.js')
        return KEYBOARD_SHORTCUTS.length
      })
      assert.equal(await page.locator('#keyboardShortcutsDialog tr').count(), shortcutCount)
      await page.keyboard.press('ArrowRight')
      assert.equal(await page.evaluate(() => window._practiceIdx), 0)
      await page.keyboard.press('/')
      assert.equal(await page.evaluate(() => !!window._practiceMinimized), false, 'slash cannot search through an open dialog')
      if (!mobile && process.env.SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
        await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'cupitor-keyboard-shortcuts.png') })
      }
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#keyboardShortcutsDialog:visible').count(), 0)
      assert.equal(await page.evaluate(() => window._practiceActive), true)

      // Slash must click the existing search button: it searches this word
      // and minimizes Practice, retaining the current card. A minimized
      // session must then route slash to the visible main search instead.
      await blur()
      await page.evaluate(() => {
        window.getSelection()?.removeAllRanges()
        window.__practiceSearchClicks = 0
        $('#practiceMode .practice-search').on('click.shortcutTest', () => window.__practiceSearchClicks++)
        $('#toggleClearTextOnClickCheckbox').prop('checked', false)
      })
      await page.keyboard.press('/')
      assert.equal(await page.evaluate(() => window.__practiceSearchClicks), 1)
      assert.equal(await page.evaluate(() => window._practiceMinimized), true)
      assert.equal(await page.locator('#searchText').inputValue(), 'färgsprakande')
      await page.waitForFunction(() => window._librarySearchText === 'färgsprakande' && !document.querySelector('#result').textContent.includes('Loading…'))
      await blur()
      await page.keyboard.press('/')
      assert.deepEqual(await page.locator('#searchText').evaluate(el => [document.activeElement.id, el.value, el.selectionStart, el.selectionEnd]),
        ['searchText', 'färgsprakande', 0, 'färgsprakande'.length])
      await page.keyboard.press('/')
      assert.equal(await page.locator('#searchText').inputValue(), 'färgsprakande', 'slash never inserts itself in the main search field')
      await page.keyboard.down('/')
      await page.keyboard.down('/')
      await page.keyboard.up('/')
      assert.equal(await page.locator('#searchText').inputValue(), 'färgsprakande', 'holding slash cannot replace the selected query with slashes')
      assert.equal(await page.evaluate(() => window.__practiceSearchClicks), 1, 'hidden Practice does not intercept main search shortcuts')
      await page.keyboard.type('hagla')
      assert.equal(await page.locator('#searchText').inputValue(), 'hagla', 'typing replaces the query selected by slash')
      await blur()
      await page.keyboard.press('j')
      assert.equal(await page.evaluate(() => window._practiceIdx), 0, 'hidden Practice does not navigate behind the search page')
      await page.locator('#practiceMode .practice-restore-btn').click()
      await blur()

      // A Play request awaiting video metadata is cancelled on navigation.
      await blur()
      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(() => window.__yt.id === 'testVideo02' && window.__yt.state === 5)
      await page.evaluate(() => { window.__yt.id = 'other-video'; window.__yt.holdId = true; window.__yt.events = [] })
      await page.keyboard.press('Space')
      await page.waitForFunction(() => window.__yt.events.some(e => e.action === 'load'))
      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(() => window.__yt.id === 'testVideo01' && window.__yt.state === 5)
      const afterNavigation = (await state()).events.length
      await page.waitForTimeout(1200)
      assert.equal((await state()).events.slice(afterNavigation).filter(e => ['play', 'load', 'seek'].includes(e.action)).length, 0,
        'a superseded load cannot seek or play the later card')
      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(() => window.__yt.id === 'testVideo03' && window.__yt.state === 5 && window.__yt.time === 12)
      assert.equal((await state()).state, 5, 'a manual video link is silently cued at its URL timestamp')
      await page.evaluate(() => { window.ytPlayerReady = false; window.__yt.holdId = false; window.__yt.events = [] })
      await page.locator('#practiceMode .practice-media-link').click()
      await blur()
      await page.keyboard.press('ArrowRight')
      await page.evaluate(() => window.onPlayerReady({ target: window.ytPlayer }))
      await page.waitForFunction(() => window.__yt.events.some(e => e.action === 'cue' && e.id === 'testVideo01'))
      assert.equal((await state()).events.filter(e => ['play', 'load', 'seek'].includes(e.action)).length, 0,
        'a delayed manual YouTube link must not start over the next card')

      // A shadowing-take rewind uses the shared seek retry loop too. Its
      // retry must not seek (and start) a new card after navigation.
      await page.evaluate(() => {
        window.closePracticeMode()
        window.AudioBridge = { postMessage: message => {
          const { rid } = JSON.parse(message)
          queueMicrotask(() => window.__cupAudio({ rid, result: null }))
        } }
        const cards = window.__practiceTestCards.map((it, i) => i ? it :
          { ...it, practiceTakes: [{ t1: 2.5, url: 'file:///saved-take.wav' }] })
        window.openPracticeMode({ queue: cards, single: true })
      })
      await page.waitForFunction(() => window.__yt.id === 'testVideo01' && window.__yt.state === 5)
      await page.evaluate(() => { window.__yt.time = 90; window.__yt.holdSeek = true; window.__yt.events = [] })
      await page.locator('#practiceMode .prec-take').click()
      await page.waitForFunction(() => window.__yt.events.some(e => e.action === 'seek'))
      await blur()
      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(() => window.__yt.id === 'testVideo02' && window.__yt.state === 5)
      const afterTakeNavigation = (await state()).events.length
      await page.waitForTimeout(1200)
      assert.equal((await state()).events.slice(afterTakeNavigation).filter(e => ['play', 'load', 'seek'].includes(e.action)).length, 0,
        'a previous card shadowing rewind cannot retry its seek on the new card')
      await page.evaluate(() => { window.__yt.holdSeek = false })

      // Closing before the player becomes ready also suppresses boot autoplay.
      await page.evaluate(() => { window.ytPlayerReady = false; window.__yt.events = []; window.openPracticeMode({ queue: window.__practiceTestCards, single: true }) })
      await blur()
      await page.keyboard.press('Escape')
      await page.evaluate(() => window.onPlayerReady({ target: window.ytPlayer }))
      await page.waitForTimeout(200)
      assert.equal((await state()).events.filter(e => ['play', 'load', 'cue'].includes(e.action)).length, 0)
      await blur()
      await page.keyboard.press('/')
      assert.equal(await page.evaluate(() => document.activeElement.id), 'searchText')
      await page.keyboard.press('/')
      assert.equal(await page.locator('#searchText').inputValue(), 'hagla', 'slash selects an already-focused main search field without inserting text')
      assert.deepEqual(await page.locator('#searchText').evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 5])
      await page.keyboard.press('?')
      assert.equal(await page.locator('#keyboardShortcutsDialog:visible').count(), 0)
      await page.locator('#toggleSettingsPanelBtn').click()
      if (mobile) {
        assert.equal(await page.locator('#settingsPanel .keyboard-shortcuts-btn').isVisible(), false)
        await page.keyboard.press('Escape')
      } else {
        await page.locator('#settingsPanel .keyboard-shortcuts-btn').click()
        await page.locator('#keyboardShortcutsDialog').waitFor({ state: 'visible' })
        assert.equal(await page.locator('#settingsPanel:visible').count(), 0)
        await page.keyboard.press('Escape')
      }
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: silent Practice transitions, cancelled loads and keyboard shortcuts passed`)
    } finally { await page.close() }
  }
}
module.exports = { checkPracticeControls }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try { await checkPracticeControls(browser) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
