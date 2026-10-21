const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function check(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  const errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => d.type() === 'confirm' ? d.accept() : (errors.push(d.message()), d.dismiss()))
  await page.route('**/*', serveFixtures)
  await page.addInitScript(wav => {
    window.dontConfirmOnRefresh = true
    const s = window.__spotify = { position: 0, paused: true, commands: [], listeners: {}, uri: '' }
    const emit = () => s.listeners.playback_update?.({data: {
      playingURI: s.uri, position: s.position * 1000, duration: 120000, isPaused: s.paused, isBuffering: false,
    }})
    window.__cupSpotifyEmbedApi = { createController(mount, options, ready) {
      const iframe = document.createElement('iframe'); iframe.title = 'Spotify test embed'; mount.replaceWith(iframe)
      window.__originalSpotifyIframe = iframe
      ready({
        addListener(name, fn) { s.listeners[name] = fn },
        loadEntity(uri, video, start) { s.uri = uri; s.position = start; s.paused = true; s.commands.push(['load', start]); queueMicrotask(() => { s.listeners.ready?.({}); emit() }) },
        seek(time) { s.position = time; s.commands.push(['seek', time]); emit() },
        play() { s.paused = false; s.commands.push(['play']); emit() },
        resume() { s.paused = false; s.commands.push(['resume']); emit() },
        pause() { s.paused = true; s.commands.push(['pause']); emit() },
      })
      setInterval(() => { if (!s.paused) { s.position += 0.1; emit() } }, 100)
    } }
    window.__audioRequests = []; window.__takeAudios = []
    const OriginalAudio = window.Audio
    window.Audio = function(...args) { const audio = new OriginalAudio(...args); window.__takeAudios.push(audio); return audio }
    window.Audio.prototype = OriginalAudio.prototype
    window.AudioBridge = { postMessage(raw) {
      const r = JSON.parse(raw); window.__audioRequests.push(r)
      if (r.op === 'recordStart') window.__recordURL = 'file:///' + r.id + '.wav'
      const result = r.op === 'ensureMicPerm' ? 'granted'
        : ['recordStart', 'recordStop'].includes(r.op) ? window.__recordURL
        : r.op === 'load' ? wav : r.op === 'musicList' ? '[]' : null
      queueMicrotask(() => window.__cupAudio?.({rid: r.rid, result}))
    } }
  }, silentWav())
  const click = async selector => {
    await page.keyboard.press('Shift') // wake study controls before pointer input
    if (mobile) await page.locator(selector).tap(); else await page.locator(selector).click()
  }
  const playing = () => page.waitForFunction(() => !window.__spotify.paused)
  const takePlaying = () => page.waitForFunction(() => document.querySelector('.prec-status')?.textContent === 'your take' && window.__takeAudios.some(a => !a.paused))
  const finishTake = () => page.evaluate(() => { const audio = window.__takeAudios.at(-1); audio.pause(); audio.dispatchEvent(new Event('ended')) })
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
    await page.evaluate(() => {
      const spotify = (id, start, end) => ({ id, manual: true, source: id, target: 'translation', mediaUrl: 'spotify:episode:1ITvLBQG5IMWcE4BD0V49f', captionUrl: 'spotify:episode:1ITvLBQG5IMWcE4BD0V49f', captionStarts: [start], captionEnds: [end] })
      const stored = [spotify('first', 30, 34), spotify('second', 60, 64), { id: 'text', manual: true, source: 'Text only', target: 'Text' }]
      window._recordings.Speak = { items: { Manual: { Card: stored } } }
      Object.assign(window._appSettings, { recPlayShuffle: false, practiceRevealMode: 'flip' })
      window.__ytPlays = 0
      window.ytPlayer = { pauseVideo() {}, mute() {}, unMute() {}, getCurrentTime() { return 900 }, playVideo() { window.__ytPlays++ } }
      window.openPracticeMode({ single: true, queue: stored.map((it, idx) => ({...it, _recName: 'Speak', _st: 'Manual', _w: 'Card', _idx: idx})) })
    })
    await page.locator('#spotifyClipPlayer iframe').waitFor({ state: 'visible' })
    await page.locator('.prec-toggle').waitFor({ state: 'visible' })
    await click('.practice-play'); await playing()
    assert.equal(await page.evaluate(() => document.querySelector('#spotifyClipPlayer iframe') === window.__originalSpotifyIframe && document.body.classList.contains('study-spotify')), true)
    assert.equal(await page.evaluate(() => window.__ytPlays), 0, 'visible Play must never dispatch to YouTube')
    await click('.practice-play')
    assert.equal(await page.evaluate(() => window.__spotify.paused), true)
    await page.evaluate(() => document.activeElement?.blur())
    await page.keyboard.press('Space'); await playing()
    await page.waitForTimeout(350)
    await click('.prec-toggle')
    await page.waitForFunction(() => window.__audioRequests.some(r => r.op === 'recordStart'))
    assert.equal(await page.evaluate(() => window.__spotify.paused), true, 'Rec pauses Spotify at its own clock')
    await click('.prec-toggle.on'); await takePlaying()
    assert.equal(await page.evaluate(() => window.__spotify.paused), true, 'the recorded take sounds while Spotify is held')
    await finishTake(); await playing()
    await click('.prec-keep')
    const saved = await page.evaluate(() => window._recordings.Speak.items.Manual.Card[0].practiceTakes)
    assert.equal(saved.length, 1); assert(saved[0].t1 >= 30 && saved[0].t1 < 34, 'take uses Spotify time, not the YouTube clock at 900s')
    await click('.prec-take'); await takePlaying(); await finishTake(); await playing()
    await click('.practice-next')
    await page.waitForFunction(() => window._practiceIdx === 1 && window.__spotify.position === 60)
    assert.equal(await page.locator('.prec-take').count(), 0, 'takes stay with their original card')
    await click('.prec-toggle'); await click('.prec-toggle.on'); await takePlaying()
    await finishTake(); await playing()
    await page.evaluate(() => {
      const s = window.__spotify; s.position = 64
      s.listeners.playback_update({data: {playingURI: s.uri, position: 64000, duration: 120000, isPaused: false, isBuffering: false}})
    })
    await page.getByRole('button', {name: 'Replay Spotify clip', exact: true}).waitFor({state: 'visible'})
    await click('.practice-play'); await takePlaying()
    await finishTake(); await playing()
    await click('.prec-drop')
    await page.waitForFunction(() => window.__audioRequests.some(r => r.op === 'delete'))
    assert.equal(await page.locator('.prec-take').count(), 0)
    await click('.prec-toggle')
    await click('.practice-next')
    await page.waitForFunction(() => window._practiceIdx === 2 && window.__audioRequests.some(r => r.op === 'recordCancel'))
    assert.equal(await page.locator('.practice-rec-bar').isVisible(), false, 'text-only cards have no speakover controls')
    assert.equal(await page.evaluate(() => document.body.classList.contains('study-spotify')), false)
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: real Practice Play routing, Spotify clock, Rec/Stop/replay, Keep/discard and navigation cancellation passed`)
  } catch (error) {
    fs.mkdirSync('test-results/dialog-browser-results/spotify', { recursive: true })
    await page.screenshot({path: 'test-results/dialog-browser-results/spotify/failure.png'}).catch(() => {})
    console.error(await page.evaluate(() => ({ body: document.body.className, index: window._practiceIdx, spotify: window.__spotify,
      bar: document.querySelector('.practice-rec-bar')?.innerText, requests: window.__audioRequests?.map(r => r.op) })))
    throw error
  } finally { await page.close() }
}
;(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] })
  try { await check(browser, false); await check(browser, true) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
