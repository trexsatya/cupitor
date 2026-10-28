// Desktop/mobile smoke test for Speak Over on an actual local-file selection.
// The test supplies a fake native AudioBridge, not a physical microphone.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const { serveFixtures } = require('./language-dialogs.cjs')

function wav() {
  const samples = 44100
  const buffer = Buffer.alloc(44 + samples * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(buffer.length - 8, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(44100, 24)
  buffer.writeUInt32LE(88200, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples * 2, 40)
  return buffer
}
async function verify(browser, mobile) {
  const page = await browser.newPage({
    viewport: mobile ? {width:390,height:820} : {width:1100,height:900},
    isMobile:mobile, hasTouch:mobile,
  })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(data => {
    window.dontConfirmOnRefresh = true
    window.AudioBridge = {
      postMessage(raw) {
        const request = JSON.parse(raw)
        window.__localSpeakOverCalls = window.__localSpeakOverCalls || []
        window.__localSpeakOverCalls.push(request.op)
        const results = {
          ensureMicPerm:'granted',
          recordStart:'file:///test-speakover.m4a',
          recordStop:'file:///test-speakover.m4a',
          load:data,
          delete:true,
          recordCancel:true,
        }
        queueMicrotask(() => {
          if (window.__cupAudio) window.__cupAudio({rid:request.rid,result:results[request.op]})
        })
      },
    }
  }, 'data:audio/wav;base64,' + wav().toString('base64'))
  await page.route('**/*', serveFixtures)
  try {
    await page.goto('http://127.0.0.1:3000/language.html', {waitUntil:'networkidle'})
    await page.waitForFunction(() => typeof window.loadLocalFiles === 'function')
    await page.locator('#localFiles').setInputFiles({
      name:'lesson.wav', mimeType:'audio/wav', buffer:wav(),
    })
    await page.locator('#localSubtitlePickerDialog').waitFor()
    await page.locator('#localSubtitlePickerDialog button').filter({hasText:'Play without subtitles'}).click()
    await page.locator('#localSpeakOverBar').waitFor({state:'visible'})
    assert.match(await page.locator('#localSpeakOverBar').innerText(), /Speak Over/)
    await page.locator('#localSpeakOverBar .local-sprec-rec').click()
    await page.waitForFunction(() => document.querySelector('#localSpeakOverBar .local-sprec-rec')?.getAttribute('aria-label') === 'Stop recording')
    assert.equal(await page.locator('#localAudio').evaluate(x => x.paused), true)
    await page.locator('#localSpeakOverBar .local-sprec-rec').click()
    await page.locator('#localSpeakOverBar .local-sprec-play-take').waitFor()
    assert.equal(await page.locator('#localSpeakOverBar .local-sprec-play-take').count(),1)
    // The Keep action preserves the timestamped recording for the same file.
    await page.locator('#localSpeakOverBar .local-sprec-keep').click()
    assert.match(await page.locator('#localSpeakOverBar').innerText(), /kept for this local file/i)
    assert((await page.evaluate(() => window.__localSpeakOverCalls)).includes('recordStart'))
    assert((await page.evaluate(() => window.__localSpeakOverCalls)).includes('recordStop'))
    assert.deepEqual(errors, [])
    console.log((mobile ? 'Mobile' : 'Desktop') + ': local speak-over passed')
  } finally {
    await page.close()
  }
}

if (require.main === module) (async () => {
  const browser = await chromium.launch({
    headless:true,
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args:['--no-sandbox','--disable-dev-shm-usage'],
  })
  try {
    await verify(browser, false)
    await verify(browser, true)
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
