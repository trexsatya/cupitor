const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { serveFixtures } = require('./language-dialogs.cjs')
const { silentWav } = require('./player-replay.cjs')

async function checkDivider(page, view, mobile) {
  const divider = page.getByRole('separator', { name: `Resize ${view === 'player' ? 'Player' : 'Practice'} player and text` })
  await divider.waitFor({ state: 'visible' })
  const before = await divider.boundingBox()
  const media = page.locator(view === 'practice' ? 'body.practice-manual #practiceAudio, body:not(.practice-manual) #mediaContainer' :
    'body.rec-playing-manual #recPlayingAudio, body:not(.rec-playing-manual) #mediaContainer')
  const height = (await media.boundingBox()).height
  const x = before.x + before.width / 2, y = before.y + before.height / 2
  if (mobile) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + step * 10 }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(x, y); await page.mouse.down()
    await page.mouse.move(x, y + 60, { steps: 6 }); await page.mouse.up()
  }
  const after = await divider.boundingBox()
  assert(after.y > before.y + 20, `${view}: drag moves the boundary`)
  assert((await media.boundingBox()).height > height + 20, `${view}: media resizes with the boundary`)
  const text = page.locator(view === 'practice' ? '#practiceMode .practice-card' : '#recPlayingSubs')
  assert((await text.boundingBox()).y >= after.y + after.height - 1, `${view}: text clears the divider`)
  assert(await page.evaluate(view => Number.isFinite(window._appSettings['studySplit_' + view]), view), 'ratio is saved')
  await divider.evaluate(el => el.focus())
  const item = await page.evaluate(() => window._practiceActive ? window._practiceIdx : window._recPlayIndex)
  await page.keyboard.press('ArrowUp')
  assert(Math.abs((await divider.boundingBox()).y - (after.y - 10)) < 1)
  assert.equal(await page.evaluate(() => window._practiceActive ? window._practiceIdx : window._recPlayIndex), item)
}

async function checkStudyControls(browser) {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1280, height: 900 }, isMobile: mobile, hasTouch: mobile })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('dialog', d => { errors.push(d.message()); d.dismiss() })
    page.setDefaultTimeout(15000)
    await page.route('**/*', route => new URL(route.request().url()).hostname === 'appassets.androidplatform.net'
      ? route.fulfill({ contentType: 'audio/wav', body: Buffer.from(silentWav().split(',')[1], 'base64') }) : serveFixtures(route))
    await page.addInitScript(() => { window.dontConfirmOnRefresh = true })
    const playerAt = i => page.waitForFunction(i => window._recPlayIndex === i && window._recPlayCurrentItem === window._recPlayQueue[i] &&
      window._recNavGotoIndex == null && !window._recNavRequest, i)
    const next = () => page.locator('#recPlayingNextBtn').click()
    const replay = () => page.getByRole('button', { name: 'Replay current item', exact: true }).click()
    const screenshot = async name => {
      if (!mobile || !process.env.SCREENSHOT_DIR) return
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true })
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, name + '.png') })
    }
    try {
      await page.goto('http://127.0.0.1:3000/language.html', { waitUntil: 'networkidle' })
      await page.evaluate(async () => Promise.all([window._vocabularyReadyPromise, window._subtitlesReadyPromise]))
      await page.evaluate(wav => {
        const s = window.__yt = { id: 'testVideo01', time: 0, state: 2, rate: 1.25, muted: false }
        window.ytPlayer = {
          pauseVideo: () => { s.state = 2 }, playVideo: () => { s.state = 1 },
          loadVideoById: value => { s.id = typeof value === 'string' ? value : value.videoId; s.time = value.startSeconds || 0; s.rate = 1; s.state = 1 },
          cueVideoById: value => { s.id = value.videoId; s.time = value.startSeconds || 0; s.state = 5 },
          seekTo: time => { s.time = time }, getCurrentTime: () => s.time,
          getPlayerState: () => s.state, getVideoData: () => ({ video_id: s.id }), getDuration: () => 1000,
          getVideoUrl: () => 'https://youtube.com/watch?v=' + s.id, getIframe: () => document.getElementById('youtubePlayer'),
          setPlaybackRate: rate => { s.rate = rate }, getPlaybackRate: () => s.rate,
          getAvailablePlaybackRates: () => [0.5, 0.75, 1, 1.25], addEventListener: () => {},
          isMuted: () => s.muted, mute: () => { s.muted = true }, unMute: () => { s.muted = false }
        }
        window.ytPlayerReady = true
        window.AudioBridge = { postMessage: message => {
          const { rid, op } = JSON.parse(message)
          const result = op === 'musicList' ? JSON.stringify([{ url: 'file:///calm.wav' }, { url: 'file:///rain.wav' }]) : wav
          queueMicrotask(() => window.__cupAudio({ rid, result }))
        } }
        Object.assign(window._appSettings, { recPlayShuffle: false, recPlayGapSeconds: 30, recPlayLoop: 'off' })
        const queue = [
          { id: 'testVideo01', source: 'YouTube', searchText: 'färgsprakande', timeStart: 1, timeEnd: 3, lineIndex: 1 },
          { id: 'testVideo02', source: 'YouTube', searchText: 'hagla', timeStart: 3, timeEnd: 5, lineIndex: 2 },
          { id: 'card1', manual: true, source: 'Hej', target: 'Hello', sourceAudioUrl: 'file:///source.wav' },
          { id: 'card2', manual: true, source: 'Tack', target: 'Thanks', sourceAudioUrl: 'file:///source.wav' }
        ]
        window.__playerTask = window.playRecording({ resumeQueue: { queue, pos: 0 }, startPaused: true })
      }, silentWav())
      await playerAt(0)
      const practice = page.getByRole('button', { name: 'Switch to Practice', exact: true })
      assert.equal(await practice.isVisible(), false, 'Practice action starts inside collapsed info')
      assert.equal(await page.locator('.rec-pb-replay-btn .study-mobile-icon').isVisible(), mobile)
      assert.equal(await page.locator('.rec-pb-replay-btn .study-desktop-label').isVisible(), !mobile)
      await replay()
      await page.waitForFunction(() => window.__yt.state === 1 && window.__yt.rate === 0.75)
      await replay()
      await page.waitForFunction(() => !window._recNavGotoIndex && window.__yt.state === 1 && window.__yt.rate === 0.75)
      await checkDivider(page, 'player', mobile)
      await screenshot('cupitor-player-controls-mobile')
      await next()
      await playerAt(1)
      await page.waitForFunction(() => window.__yt.id === 'testVideo02' && window.__yt.state === 1 && window.__yt.rate === 1.25)

      if (!await practice.isVisible()) await page.getByRole('button', { name: 'Show details', exact: true }).click()
      await practice.click()
      await page.waitForFunction(() => window._practiceActive && window._practiceIdx === 1 && !document.querySelector('#practiceMode .practice-loading'))
      await checkDivider(page, 'practice', mobile)
      await screenshot('cupitor-practice-video-resize-mobile')
      await page.setViewportSize({ width: 844, height: 390 })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const landscape = await page.locator('#practiceMode .practice-card').boundingBox()
      assert(landscape.y >= 64 && landscape.y + landscape.height <= 390 && landscape.height >= 40,
        'landscape keeps a usable text region below the media')
      await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 })
      await page.getByRole('button', { name: 'Switch to Player', exact: true }).click()
      await playerAt(1)

      // Both profiles use one library, but changing one cannot change the
      // other's track, timing, volume or enable state.
      await page.evaluate(() => {
        window._appSettings.recMusicTracks = [
          { id: 'local:calm.wav', kind: 'local', url: 'file:///calm.wav', name: 'Calm' },
          { id: 'local:rain.wav', kind: 'local', url: 'file:///rain.wav', name: 'Rain' }
        ]
        window.openMusicPanel()
      })
      await page.locator('#mpScope').selectOption('manual')
      await page.locator('#mpEnabled').check()
      await page.locator('#mpTrack').selectOption('local:calm.wav')
      await page.locator('input[name=mpMode][value=item]').check()
      await page.locator('#mpVol_withAudio').evaluate(el => { el.value = '15'; el.dispatchEvent(new Event('input', { bubbles: true })) })
      await page.locator('#mpScope').selectOption('video')
      await page.locator('#mpEnabled').check()
      await page.locator('#mpTrack').selectOption('local:rain.wav')
      await page.locator('input[name=mpMode][value=item]').check()
      await page.locator('#mpVol_withAudio').evaluate(el => { el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })) })
      await page.waitForFunction(() => {
        const audio = document.querySelector('#recMusicHost audio')
        return audio && !audio.paused && audio.src.endsWith('rain.wav') && Math.abs(audio.volume - 0.3) < 0.01
      })
      await page.locator('#mpEnabled').uncheck()
      await page.waitForFunction(() => document.querySelector('#recMusicHost audio').paused)
      await page.locator('#mpScope').selectOption('manual')
      assert.equal(await page.locator('#mpTrack').inputValue(), 'local:calm.wav')
      assert.equal(await page.locator('#mpVol_withAudio').inputValue(), '15')
      assert(await page.locator('#mpEnabled').isChecked())
      await screenshot('cupitor-music-profiles-mobile')
      await page.locator('#musicPanelDialog').locator('..').locator('.ui-dialog-titlebar-close').click()

      await next(); await playerAt(2)
      await page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused)
      await replay()
      await page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused && window._recPlayManualAudio.playbackRate === 0.75)
      await page.waitForFunction(() => document.querySelector('#recMusicHost audio').src.endsWith('calm.wav') && !document.querySelector('#recMusicHost audio').paused)
      await next(); await playerAt(3)
      await page.waitForFunction(() => window._recPlayManualAudio && !window._recPlayManualAudio.paused && window._recPlayManualAudio.playbackRate === 1)
      await checkDivider(page, 'player', mobile)
      const playerBoundary = (await page.locator('#studyMediaDivider').boundingBox()).y
      if (!await practice.isVisible()) await page.getByRole('button', { name: 'Show details', exact: true }).click()
      await practice.click()
      await page.waitForFunction(() => window._practiceActive && window._practiceIdx === 3)
      await checkDivider(page, 'practice', mobile)
      const player = page.getByRole('button', { name: 'Switch to Player', exact: true })
      assert.equal(await player.locator('.study-mobile-icon').isVisible(), mobile)
      await page.locator('#practiceMode .practice-settings').click()
      assert.equal(await page.locator('#practiceMode .keyboard-shortcuts-btn').isVisible(), !mobile)
      await page.locator('#practiceMode .practice-settings').click()
      await screenshot('cupitor-practice-resize-mobile')
      const practiceRatio = await page.evaluate(() => window._appSettings.studySplit_practice)
      await player.click(); await playerAt(3)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert(Math.abs((await page.locator('#studyMediaDivider').boundingBox()).y - playerBoundary) < 1,
        'returning to Player restores its own divider position')
      assert.equal(await page.evaluate(() => window._appSettings.studySplit_practice), practiceRatio)
      await page.locator('#recPlayingCloseBtn').click()
      await page.evaluate(() => window.__playerTask)
      assert.equal(await page.locator('#studyMediaDivider').isVisible(), false)
      assert.deepEqual(errors, [])
      console.log(`${mobile ? 'Mobile' : 'Desktop'}: icons, hidden shortcuts, Replay rates, independent music, and draggable Player/Practice sections passed`)
    } finally { await page.close() }
  }
}
module.exports = { checkStudyControls }
if (require.main === module) (async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] })
  try { await checkStudyControls(browser) } finally { await browser.close() }
})().catch(e => { console.error(e); process.exitCode = 1 })
