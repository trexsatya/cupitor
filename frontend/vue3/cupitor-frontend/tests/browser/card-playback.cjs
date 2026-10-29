const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function checkCardPlayback(browser, mobile) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
  await page.route('**/*', serveFixtures)
  await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
  const click = async selector => { await page.keyboard.press('Shift'); await page.locator(selector).click() }
  const stop = async () => {
    await page.evaluate(() => window.stopPlayingRecording())
    await page.evaluate(() => window.__task)
  }
  const start = async mode => {
    await page.evaluate(mode => {
      window.__yt.events = []; window.__loads = []
      window._appSettings.recManualPlaybackMode = mode
      window.__task = window.playRecording({ queue: window.__cards, shuffle: false, temporary: true })
    }, mode)
    await page.waitForFunction(() => window._playingRecording && window._recPlayIndex === 0)
  }
  // Loading already reports PLAYING while the seek is being confirmed muted.
  // Advance the fixture only after preparation releases the mute.
  const videoPlaying = () => page.waitForFunction(() => !!window._recPlayLinkedVideo &&
    window.__yt.state === 1 && window.__yt.time === 60 && !window.__yt.muted)
  const audioPlaying = () => page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused)
  const endAudio = async () => {
    await page.waitForFunction(() => window._recPlayManualAudio?.readyState >= 2 && window._recPlayManualAudio.duration > 0)
    await page.evaluate(() => { const a = window._recPlayManualAudio; a.currentTime = a.duration - 0.01 })
  }
  const screenshot = async name => {
    if (!process.env.SCREENSHOT_DIR) return
    fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
    const target = name === 'card-playback-settings' ? page.locator('#settingsPanel').locator('..')
      : name === 'card-playback-player' ? page.locator('#recPlayingBanner') : page
    await target.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${name}-${mobile ? 'mobile' : 'desktop'}.png`), animations: 'disabled' })
  }
  try {
    await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
    await page.evaluate(async wav => {
      await Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise])
      Object.assign(window._appSettings, { recPlayGapSeconds: 0, recPlaySrcTgtGapSeconds: 0, recPlayShuffle: false, recPlayLoop: 'off' })
      window.__cards = [
        { manual: true, id: 'media-one', source: 'Du är i rätta händer.', target: 'You are in good hands.',
          mediaUrl: 'https://youtu.be/testVideo01?t=60', sourceAudioUrl: 'file:///source.wav', targetAudioUrl: 'file:///target.wav', _temporary: true },
        { manual: true, id: 'media-two', source: 'Nästa exempel börjar här.', target: 'The next example begins here.',
          mediaUrl: 'https://youtu.be/testVideo01?t=72', _temporary: true },
      ]
      window.__savedCards = JSON.stringify(window.__cards)
      const s = window.__yt = { id: 'boot', time: 0, state: 2, events: [], muted: false }
      const log = action => s.events.push({ action, time: s.time })
      window.ytPlayer = {
        getIframe: () => document.getElementById('youtubePlayer'), getVideoData: () => ({ video_id: s.id }),
        getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id, getPlayerState: () => s.state, getCurrentTime: () => s.time,
        getDuration: () => 2000, getPlaybackRate: () => 1, setPlaybackRate: () => {}, getAvailablePlaybackRates: () => [1], addEventListener: () => {},
        mute: () => { s.muted = true }, unMute: () => { s.muted = false }, isMuted: () => s.muted,
        loadVideoById: v => { s.id = v.videoId; s.time = v.startSeconds || 0; s.state = 1; log('load') },
        seekTo: value => { s.time = value; log('seek') }, playVideo: () => { s.state = 1; log('play') },
        pauseVideo: () => { s.state = 2; log('pause') },
        cueVideoById: v => { s.id = v.videoId; s.time = v.startSeconds || 0; s.state = 5; log('cue') },
      }
      window.ytPlayerReady = true
      const frame = document.getElementById('youtubePlayer')
      frame.style.cssText = 'background:#141921;color:white;display:flex;align-items:center;justify-content:center;'
      frame.textContent = 'YouTube · sample clip'
      window.AudioBridge = { postMessage(raw) {
        const r = JSON.parse(raw)
        if (r.op === 'load') window.__loads.push(r.url)
        queueMicrotask(() => window.__cupAudio({ rid: r.rid, result: r.op === 'load' ? wav : null }))
      } }
    }, silentWav())
    assert.equal(await page.evaluate(() => window._appSettings.recPlayYouTubeClipSeconds), 20)
    await start('both')
    await videoPlaying()
    assert.equal(await page.locator('.rec-pb-clip-range').textContent(), 'YouTube clip 00:01:00 – 00:01:12 · automatic end')
    assert.deepEqual(await page.evaluate(() => window.__loads), [], 'linked clip plays before recordings')
    await click('#recPlayingPauseBtn')
    assert.equal(await page.evaluate(() => window.__yt.state), 2, 'pause reaches a linked manual video')
    await click('#recPlayingPauseBtn')
    assert.equal(await page.evaluate(() => window.__yt.state), 1)
    await page.waitForTimeout(150)
    await page.evaluate(() => { window.__yt.time = 72 })
    await audioPlaying()
    assert.equal(await page.evaluate(() => window.__yt.state), 2, 'video stops at the next clip start')
    await page.waitForFunction(() => {
      const video = document.querySelector('#mediaContainer').getBoundingClientRect()
      const audio = document.querySelector('#recPlayingAudio').getBoundingClientRect()
      const text = document.querySelector('#recPlayingSubs').getBoundingClientRect()
      return document.body.classList.contains('study-media-combined') && audio.top >= video.bottom - 1 && text.top >= audio.bottom + 8
    })
    assert.deepEqual(await page.evaluate(() => window.__loads), ['file:///source.wav'])
    await endAudio()
    await page.waitForFunction(() => window.__loads.length === 2)
    await audioPlaying()
    await endAudio()
    await page.waitForFunction(() => window._recPlayIndex === 1 && window.__yt.time === 72 && window.__yt.state === 1)
    await stop()
    await start('recordings')
    await audioPlaying()
    assert.equal(await page.evaluate(() => window.__yt.events.some(e => ['load', 'play', 'seek'].includes(e.action))), false,
      'recordings-only does not start the link')
    await stop()
    await start('linked')
    await videoPlaying()
    await page.waitForTimeout(150)
    await page.evaluate(() => { window.__yt.time = 72 })
    await page.waitForFunction(() => window._recPlayIndex === 1)
    assert.deepEqual(await page.evaluate(() => window.__loads), [], 'linked-only skips both face recordings')
    await stop()
    await start('both')
    await videoPlaying()
    if (mobile) await click('.rec-pb-info-btn')
    await page.selectOption('.rec-pb-media-mode', 'recordings')
    await audioPlaying()
    assert.equal(await page.evaluate(() => window._recPlayIndex), 0, 'changing the selector restarts this card')
    await page.selectOption('.rec-pb-media-mode', 'both')
    await videoPlaying()
    await click('#recPlayingPauseBtn')
    if (mobile && !await page.locator('.rec-pb-media-mode').isVisible()) await click('.rec-pb-info-btn')
    await screenshot('card-playback-player')
    await stop()
    await click('#toggleSettingsPanelBtn')
    await page.locator('#recPlayYouTubeClipSeconds').fill('8')
    await page.locator('#recPlayYouTubeClipSeconds').press('Tab')
    await page.locator('#settingsPanel').locator('..').locator('.ui-dialog-titlebar-close').click()
    await start('linked')
    await videoPlaying()
    assert.match(await page.locator('.rec-pb-clip-range').textContent(), /00:01:08/)
    await stop()
    await click('#toggleSettingsPanelBtn')
    await page.locator('#recPlayYouTubeClipSeconds').fill('20')
    await page.locator('#recPlayYouTubeClipSeconds').press('Tab')
    await page.selectOption('#recManualPlaybackMode', 'both')
    await page.locator('#recManualPlaybackMode').scrollIntoViewIfNeeded()
    await screenshot('card-playback-settings')
    await page.locator('#settingsPanel').locator('..').locator('.ui-dialog-titlebar-close').click()
    await page.evaluate(() => window.openPracticeMode({ queue: [{ ...window.__cards[0], targetAudioUrl: null }, window.__cards[1]], temporary: true }))
    await page.waitForFunction(() => document.body.classList.contains('study-media-combined') &&
      document.querySelector('#practiceAudio .rec-pa-el') && document.querySelector('#practiceMode .practice-manual-text'))
    const checkStack = async () => {
      await page.waitForFunction(() => {
        const audio = document.querySelector('#practiceAudio')?.getBoundingClientRect()
        const card = document.querySelector('#practiceMode .practice-card')?.getBoundingClientRect()
        const video = document.querySelector('#mediaContainer')?.getBoundingClientRect()
        return audio && card && video && audio.top >= video.bottom - 1 && card.top >= audio.bottom + 8 &&
          card.top < window.innerHeight - 100
      })
    }
    await checkStack()
    // Saving a second voice recording grows the existing panel without
    // changing its body classes. Resize observation must reserve the new row.
    await page.evaluate(() => { window._practiceCards[0].targetAudioUrl = 'file:///target.wav' })
    await click('#practiceMode .practice-settings')
    await click('#practiceMode .practice-dir')
    await page.waitForFunction(() => document.querySelectorAll('#practiceAudio .rec-pa-face-btn').length === 2)
    await checkStack()
    await click('#practiceMode .practice-dir')
    await click('#practiceMode .practice-settings')
    await checkStack()
    await click('#practiceAudio .rec-pa-face-btn:first-child')
    await page.waitForFunction(() => !document.querySelector('#practiceAudio .rec-pa-el').paused)
    await click('#practiceMode .practice-media-link')
    await page.waitForFunction(() => window.__yt.state === 1 && !window._practicePlayPending)
    assert.equal(await page.locator('#practiceAudio .rec-pa-el').evaluate(el => el.paused), true,
      'playing the linked video stops the face recording')
    await checkStack()
    await screenshot('card-playback-practice')
    for (const viewport of [{ width: 320, height: 640 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport)
      await checkStack()
    }
    assert.equal(await page.evaluate(() => JSON.stringify(window.__cards) === window.__savedCards), true, 'runtime ends never change saved items')
    assert.deepEqual(errors, [])
    console.log(`${mobile ? 'Mobile' : 'Desktop'}: inferred bounds, all playback modes, pause/resume, live choice and saved settings passed`)
  } catch (error) {
    console.error(await page.evaluate(() => JSON.stringify({ loads: window.__loads, playing: window._playingRecording,
      index: window._recPlayIndex, yt: window.__yt, paused: window._recPlayPaused })), errors)
    throw error
  } finally { await page.close() }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { for (const mobile of [false, true]) await checkCardPlayback(browser, mobile) } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
